package daktronics

import "time"

// Clock.tsx flips a changed digit in five 50 ms steps: the old digit squashes to its centre column over 250 ms,
// then the new one grows back out over the next 250 ms. The colons blink off for the first 250 ms of every second.
const (
	clockFlipStep  = 50
	clockFlipSteps = 5
	clockFlipHalf  = clockFlipStep * clockFlipSteps
	clockColonOff  = 250
)

// clock tracks when each character of HH:MM:SS last changed so the flip can be replayed on any tick.
type clock struct {
	digits  [8]byte
	changed [8]time.Time
	second  time.Time
	started bool
}

// digitScene is one clock character this tick: the glyph to draw and the columns of its cell that are lit,
// as [left, right) in cell dots.
type digitScene struct {
	ch          byte
	left, right int8
}

type clockScene [8]digitScene

// update notes which characters changed at now. On the first call every digit rolls in from the number
// before it, as the browser does on load.
func (c *clock) update(now time.Time, digits [8]byte) {
	if !c.started {
		c.started = true
		c.digits = digits
		c.second = now
		for i := range c.changed {
			c.changed[i] = now
		}
		return
	}
	if digits == c.digits {
		return
	}
	c.second = now
	for i := range digits {
		if digits[i] != c.digits[i] {
			c.changed[i] = now
		}
	}
	c.digits = digits
}

func (c *clock) scene(now time.Time, cell int) clockScene {
	var s clockScene
	half := int8(cell / 2)
	colonOff := now.Sub(c.second).Milliseconds() < clockColonOff
	for i, ch := range c.digits {
		if ch == ':' {
			s[i] = digitScene{ch: ch, left: 0, right: int8(cell)}
			if colonOff {
				s[i].right = 0
			}
			continue
		}
		e := now.Sub(c.changed[i]).Milliseconds()
		switch {
		case e < clockFlipHalf:
			step := int8(e/clockFlipStep) + 1
			hw := half * (clockFlipSteps - 1 - step) / (clockFlipSteps - 1)
			s[i] = digitScene{ch: previousDigit(ch, i), left: half - max(hw, 0), right: half + max(hw, 0)}
		case e < 2*clockFlipHalf:
			step := int8((e-clockFlipHalf)/clockFlipStep) + 1
			hw := half * (step - 1) / (clockFlipSteps - 1)
			s[i] = digitScene{ch: ch, left: half - hw, right: half + hw}
		default:
			s[i] = digitScene{ch: ch, left: 0, right: int8(cell)}
		}
	}
	return s
}

// previousDigit is the number a digit rolled on from, wrapping at the largest value its position can hold.
func previousDigit(ch byte, pos int) byte {
	if ch != '0' {
		return ch - 1
	}
	switch pos {
	case 0:
		return '2'
	case 3, 6:
		return '5'
	}
	return '9'
}
