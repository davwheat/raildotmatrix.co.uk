#ifndef DEPARTURE_BOARD_UPLOAD_H
#define DEPARTURE_BOARD_UPLOAD_H

#include "led-matrix-c.h"

// A cropped rectangle still has the original framebuffer's row stride. Keep
// its row calls in C so cropping does not add Go-to-C transitions or repacking.
static void set_rect(struct LedCanvas *canvas, int x, int y, int width, int height,
                     int stride, struct Color *pixels) {
  if (width == stride) {
    led_canvas_set_pixels(canvas, x, y, width, height, pixels);
  } else {
    for (int row = 0; row < height; ++row) {
      led_canvas_set_pixels(canvas, x, y + row, width, 1, pixels + row * stride);
    }
  }
}

static int same_color(const struct Color *a, const struct Color *b) {
  return a->r == b->r && a->g == b->g && a->b == b->b;
}

// Both RGB histories belong to this off-screen canvas. Skip unchanged runs
// inside a dirty rectangle without exposing the library's native bitplane layout.
static void set_changed_rect(struct LedCanvas *canvas, int x, int y, int width,
                             int height, int stride, struct Color *pixels,
                             const struct Color *previous) {
  if (!previous) {
    set_rect(canvas, x, y, width, height, stride, pixels);
    return;
  }
  // Dense changing images gain nothing from splitting runs. A small grid sample
  // selects the original bulk path; a misprediction affects only performance.
  int changed = 0;
  for (int sy = 0; sy < 4; ++sy) {
    for (int sx = 0; sx < 4; ++sx) {
      const int at = (sy * (height - 1) / 3) * stride + sx * (width - 1) / 3;
      changed += !same_color(pixels + at, previous + at);
    }
  }
  if (changed >= 12) {
    set_rect(canvas, x, y, width, height, stride, pixels);
    return;
  }
  for (int row = 0; row < height; ++row) {
    int column = 0;
    while (column < width) {
      while (column < width && same_color(pixels + column, previous + column)) ++column;
      const int start = column;
      while (column < width && !same_color(pixels + column, previous + column)) ++column;
      if (column > start) {
        led_canvas_set_pixels(canvas, x + start, y + row, column - start, 1, pixels + start);
      }
    }
    pixels += stride;
    previous += stride;
  }
}

#endif
