// Package configschema describes the board's actual flags for the management UI.
package configschema

type Field struct {
	Key       string   `json:"key"`
	Type      string   `json:"type"`
	Help      string   `json:"help"`
	Default   any      `json:"default"`
	Choices   []string `json:"choices,omitempty"`
	Automatic bool     `json:"automatic,omitempty"`
	// Boards lists the board formats the setting affects; empty means every format.
	Boards []string `json:"boards,omitempty"`
}
