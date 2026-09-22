package main

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// decodeWOFF1 unpacks a WOFF 1.0 container into the equivalent SFNT (TrueType or CFF-based OpenType) byte
// stream so that it can be parsed by golang.org/x/image/font/sfnt.
func decodeWOFF1(data []byte) ([]byte, error) {
	const headerSize = 44
	const dirEntrySize = 20
	if len(data) < headerSize {
		return nil, errors.New("woff: file too short")
	}
	if string(data[:4]) != "wOFF" {
		return nil, fmt.Errorf("woff: bad signature %q", data[:4])
	}
	flavor := data[4:8]
	numTables := int(binary.BigEndian.Uint16(data[12:14]))
	if len(data) < headerSize+numTables*dirEntrySize {
		return nil, errors.New("woff: truncated table directory")
	}

	type table struct {
		tag  []byte
		data []byte
		csum uint32
	}
	tables := make([]table, 0, numTables)
	for i := range numTables {
		e := data[headerSize+i*dirEntrySize:]
		offset := binary.BigEndian.Uint32(e[4:8])
		compLen := binary.BigEndian.Uint32(e[8:12])
		origLen := binary.BigEndian.Uint32(e[12:16])
		csum := binary.BigEndian.Uint32(e[16:20])
		if uint64(offset)+uint64(compLen) > uint64(len(data)) {
			return nil, fmt.Errorf("woff: table %q out of range", e[:4])
		}
		raw := data[offset : offset+compLen]
		var body []byte
		if compLen == origLen {
			body = raw
		} else {
			r, err := zlib.NewReader(bytes.NewReader(raw))
			if err != nil {
				return nil, fmt.Errorf("woff: table %q: %w", e[:4], err)
			}
			body, err = io.ReadAll(r)
			if err != nil {
				return nil, fmt.Errorf("woff: table %q: %w", e[:4], err)
			}
			if len(body) != int(origLen) {
				return nil, fmt.Errorf("woff: table %q: got %d bytes, want %d", e[:4], len(body), origLen)
			}
		}
		tables = append(tables, table{tag: e[:4], data: body, csum: csum})
	}

	entryShift := 0
	for 1<<(entryShift+1) <= numTables {
		entryShift++
	}
	searchRange := uint16(1 << entryShift * 16)
	rangeShift := uint16(numTables*16) - searchRange

	var out bytes.Buffer
	out.Write(flavor)
	binary.Write(&out, binary.BigEndian, uint16(numTables))
	binary.Write(&out, binary.BigEndian, searchRange)
	binary.Write(&out, binary.BigEndian, uint16(entryShift))
	binary.Write(&out, binary.BigEndian, rangeShift)

	offset := 12 + numTables*16
	for _, t := range tables {
		out.Write(t.tag)
		binary.Write(&out, binary.BigEndian, t.csum)
		binary.Write(&out, binary.BigEndian, uint32(offset))
		binary.Write(&out, binary.BigEndian, uint32(len(t.data)))
		offset += (len(t.data) + 3) &^ 3
	}
	for _, t := range tables {
		out.Write(t.data)
		for pad := (4 - len(t.data)%4) % 4; pad > 0; pad-- {
			out.WriteByte(0)
		}
	}
	return out.Bytes(), nil
}
