package live

import "strings"

// Operator names as the boards of the Data Display era showed them, keyed by Darwin operator code. A code that
// has no legacy name reads as empty, and the feed's own name is used instead.
var legacyTOCNames = map[string]string{
	"AW": "Arriva Trains Wales",
	"CC": "c2c",
	"CH": "Chiltern Railways",
	"CS": "Caledonian Sleeper",
	"EM": "East Midlands Trains",
	"ES": "Eurostar",
	"GC": "Grand Central",
	"GN": "First Capital Connect",
	"GR": "National Express East Coast",
	"GW": "First Great Western",
	"GX": "Gatwick Express",
	"HT": "Hull Trains",
	"HX": "Heathrow Express",
	"IL": "Island Line",
	"LD": "Lumo",
	"LE": "One",
	"LM": "London Midland",
	"LO": "London Overground",
	"ME": "Merseyrail",
	"NT": "Northern Rail",
	"SE": "Southeastern",
	"SN": "Southern",
	"SR": "ScotRail",
	"SW": "South West Trains",
	"TL": "First Capital Connect",
	"TP": "First Transpennine Express",
	"TW": "Tyne & Wear Metro",
	"VT": "Virgin Trains",
	"XC": "Virgin Trains",
	"XR": "TfL Rail",
}

// LegacyTOCName is the operator name a board of the era showed for a Darwin operator code, or empty.
func LegacyTOCName(code string) string {
	return legacyTOCNames[strings.ToUpper(code)]
}
