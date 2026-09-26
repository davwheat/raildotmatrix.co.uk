package board

import "time"

// NextScrollPixel mirrors integer-millisecond scrolling: position is
// elapsed.Milliseconds()*speed/1000. Round the next position's time upwards so
// fractional periods cannot postpone a visible pixel step. A corrected clock
// before the animation start retains ordinary refresh pacing.
func NextScrollPixel(now, start time.Time, speed int) time.Time {
	if speed <= 0 || now.Before(start) {
		return time.Time{}
	}
	step := now.Sub(start).Milliseconds()*int64(speed)/1000 + 1
	milliseconds := (step*1000 + int64(speed) - 1) / int64(speed)
	return start.Add(time.Duration(milliseconds) * time.Millisecond)
}
