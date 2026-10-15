// Package version identifies the build that a board is running.
//
// The justfile sets these with -ldflags -X, so a plain go build reports a development build numbered 0.
package version

import (
	"strconv"
	"time"
)

var (
	Version = "dev"
	Commit  = ""
	// Build counts the commits up to Commit, so later builds on main always have higher numbers.
	Build = "0"
	// Date is the commit time in RFC 3339 format.
	Date = ""
)

func BuildNumber() int {
	n, _ := strconv.Atoi(Build)
	return n
}

func CommitTime() time.Time {
	t, _ := time.Parse(time.RFC3339, Date)
	return t
}

func String() string {
	if Commit == "" {
		return Version
	}
	return Version + " (build " + Build + ", " + Commit + ")"
}
