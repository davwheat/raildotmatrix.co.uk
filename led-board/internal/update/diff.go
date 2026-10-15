package update

import (
	"bytes"
	"fmt"
	"strings"
	"unicode/utf8"
)

const maxDiffLines = 2000

// Diff returns a unified diff from a to b with three lines of context, or a short note if either isn't small text.
func Diff(aName string, a []byte, bName string, b []byte) string {
	if !isText(a) || !isText(b) {
		return "Binary files differ."
	}
	x, y := splitLines(a), splitLines(b)
	if len(x) > maxDiffLines || len(y) > maxDiffLines {
		return "The files are too long to compare here."
	}
	// lcs[i][j] is the length of the longest common subsequence of x[i:] and y[j:].
	lcs := make([][]int, len(x)+1)
	for i := range lcs {
		lcs[i] = make([]int, len(y)+1)
	}
	for i := len(x) - 1; i >= 0; i-- {
		for j := len(y) - 1; j >= 0; j-- {
			if x[i] == y[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else {
				lcs[i][j] = max(lcs[i+1][j], lcs[i][j+1])
			}
		}
	}
	type line struct {
		op   byte
		text string
		i, j int
	}
	var lines []line
	i, j := 0, 0
	for i < len(x) || j < len(y) {
		switch {
		case i < len(x) && j < len(y) && x[i] == y[j]:
			lines = append(lines, line{' ', x[i], i, j})
			i++
			j++
		case i < len(x) && (j == len(y) || lcs[i+1][j] >= lcs[i][j+1]):
			lines = append(lines, line{'-', x[i], i, j})
			i++
		default:
			lines = append(lines, line{'+', y[j], i, j})
			j++
		}
	}
	const context = 3
	var out strings.Builder
	fmt.Fprintf(&out, "--- %s\n+++ %s\n", aName, bName)
	for start := 0; start < len(lines); {
		if lines[start].op == ' ' {
			start++
			continue
		}
		from := max(start-context, 0)
		end := start
		for k := start; k < len(lines) && k-end <= 2*context; k++ {
			if lines[k].op != ' ' {
				end = k
			}
		}
		to := min(end+context+1, len(lines))
		var aCount, bCount int
		for _, l := range lines[from:to] {
			if l.op != '+' {
				aCount++
			}
			if l.op != '-' {
				bCount++
			}
		}
		fmt.Fprintf(&out, "@@ -%d,%d +%d,%d @@\n", lines[from].i+1, aCount, lines[from].j+1, bCount)
		for _, l := range lines[from:to] {
			out.WriteByte(l.op)
			out.WriteString(l.text)
			out.WriteByte('\n')
		}
		start = to
	}
	return out.String()
}

func isText(data []byte) bool { return utf8.Valid(data) && bytes.IndexByte(data, 0) < 0 }

func splitLines(data []byte) []string {
	if len(data) == 0 {
		return nil
	}
	return strings.Split(strings.TrimSuffix(string(data), "\n"), "\n")
}
