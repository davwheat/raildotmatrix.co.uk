// Command webbundle packages the WebAssembly build of the boards for a website: it compresses the module with
// Zopfli, names each file after its content so that it can be cached forever, and writes manifest.json to
// point at them. The page fetches the manifest without caching and un-gzips the module itself, so that the
// bundle needs no special headers from the host.
//
//	go run ./cmd/webbundle -wasm build/wasm/board.wasm -exec "$(go env GOROOT)/lib/wasm/wasm_exec.js" -out DIR
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/foobaz/go-zopfli/zopfli"
)

// manifest is what the page reads to find the bundle.
type manifest struct {
	// WASM is the gzipped module and Exec the Go runtime glue it needs, which must come from the same Go
	// release.
	WASM      string `json:"wasm"`
	Exec      string `json:"exec"`
	Size      int    `json:"size"`
	GzipSize  int    `json:"gzipSize"`
	GoVersion string `json:"goVersion"`
}

func main() {
	wasmPath := flag.String("wasm", "", "the WebAssembly module to package")
	execPath := flag.String("exec", "", "the wasm_exec.js of the Go release that built it")
	out := flag.String("out", "", "directory to write the bundle into; earlier bundles in it are removed")
	iterations := flag.Int("iterations", 15, "Zopfli iterations; more compress slightly better, and slowly")
	flag.Parse()
	if *wasmPath == "" || *execPath == "" || *out == "" {
		flag.Usage()
		os.Exit(2)
	}
	if err := run(*wasmPath, *execPath, *out, *iterations); err != nil {
		fmt.Fprintln(os.Stderr, "webbundle:", err)
		os.Exit(1)
	}
}

func run(wasmPath, execPath, out string, iterations int) error {
	wasm, err := os.ReadFile(wasmPath)
	if err != nil {
		return err
	}
	exec, err := os.ReadFile(execPath)
	if err != nil {
		return err
	}

	start := time.Now()
	var gz bytes.Buffer
	opts := zopfli.DefaultOptions()
	opts.NumIterations = iterations
	if err := zopfli.GzipCompress(&opts, wasm, &gz); err != nil {
		return fmt.Errorf("compressing %s: %w", wasmPath, err)
	}

	m := manifest{
		WASM:      "board." + digest(wasm) + ".wasm.gz",
		Exec:      "wasm_exec." + digest(exec) + ".js",
		Size:      len(wasm),
		GzipSize:  gz.Len(),
		GoVersion: runtime.Version(),
	}
	if err := os.MkdirAll(out, 0o755); err != nil {
		return err
	}
	if err := removeOld(out); err != nil {
		return err
	}
	files := map[string][]byte{m.WASM: gz.Bytes(), m.Exec: exec}
	for name, data := range files {
		if err := os.WriteFile(filepath.Join(out, name), data, 0o644); err != nil {
			return err
		}
	}
	js, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(out, "manifest.json"), append(js, '\n'), 0o644); err != nil {
		return err
	}
	fmt.Printf("%s: %d bytes, %d gzipped (%.1f%%) in %s\n", m.WASM, m.Size, m.GzipSize,
		100*float64(m.GzipSize)/float64(m.Size), time.Since(start).Round(time.Millisecond))
	return nil
}

func digest(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:6])
}

func removeOld(dir string) error {
	for _, pattern := range []string{"board.*.wasm.gz", "wasm_exec.*.js"} {
		old, err := filepath.Glob(filepath.Join(dir, pattern))
		if err != nil {
			return err
		}
		for _, f := range old {
			if err := os.Remove(f); err != nil {
				return err
			}
		}
	}
	return nil
}
