package board

import "testing"

func TestOrdinalFormats(t *testing.T) {
	for i, suffix := range []string{"1st", "2nd", "3rd", "4th", "5th", "6th"} {
		if got := PrefixOrdinals.Text(i, "2", OrdinalSuffix); got != suffix {
			t.Errorf("got %s want %s", got, suffix)
		}
		if got := PrefixOrdinals.Text(i, "2", OrdinalDot); got != string(rune('1'+i))+"." {
			t.Errorf("unexpected dot ordinal %s", got)
		}
		if got := PrefixPlatforms.Text(i, "2", OrdinalDot); got != "Pl 2" {
			t.Errorf("format changed platform prefix: %s", got)
		}
	}
	if _, err := ParseOrdinalFormat("invalid"); err == nil {
		t.Fatal("invalid format accepted")
	}
}
