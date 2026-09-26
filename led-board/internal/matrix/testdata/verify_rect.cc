// Standalone native bitplane parity check. GPIO initialisation is disabled:
// this can run beside the live display without accessing its hardware.
#include "../upload.h"
#include "led-matrix.h"
#include <cstdio>
#include <cstring>
#include <vector>

int main() {
  unsigned random = 0xabc123;
  const auto next = [&]() { random ^= random << 13; random ^= random >> 17; random ^= random << 5; return random; };
  unsigned verified = 0;
  for (int bits : {8, 11}) {
    rgb_matrix::RGBMatrix::Options opts;
    opts.rows = 64;
    opts.cols = 128;
    opts.chain_length = 2;
    opts.pwm_bits = bits;
    opts.led_rgb_sequence = bits == 8 ? "BGR" : "RGB";
    rgb_matrix::RuntimeOptions runtime;
    runtime.do_gpio_init = false;
    runtime.drop_privileges = -1;
    auto *matrix = rgb_matrix::RGBMatrix::CreateFromOptions(opts, runtime);
    if (!matrix) return 1;
    auto *reference = matrix->CreateFrameCanvas();
    rgb_matrix::FrameCanvas *canvases[] = {matrix->CreateFrameCanvas(), matrix->CreateFrameCanvas()};
    const int width = reference->width(), height = reference->height();
    std::vector<struct Color> pixels[2] = {std::vector<struct Color>(width*height), std::vector<struct Color>(width*height)};
    std::vector<struct Color> previous[2] = {pixels[0], pixels[1]};
    bool valid[] = {false, false};
    for (int tick = 0; tick < 1000; ++tick) {
      if (tick % 83 == 0) {
        matrix->SetBrightness(1 + next()%100);
        valid[0] = valid[1] = false;
      }
      const int index = tick % 2;
      auto &frame = pixels[index];
      const int x = next()%width, y = next()%height;
      const int w = 1+next()%(width-x), h = 1+next()%(height-y);
      for (int yy = y; yy < y+h; ++yy) {
        for (int xx = x; xx < x+w; ++xx) {
          if (tick % 3 != 0 && next() % 4 != 0) continue;
          auto &pixel = frame[yy*width+xx];
          pixel.r = next(); pixel.g = next(); pixel.b = next();
        }
      }
      auto *canvas = reinterpret_cast<LedCanvas*>(canvases[index]);
      if (!valid[index]) {
        set_changed_rect(canvas, 0, 0, width, height, width, frame.data(), nullptr);
        valid[index] = true;
      } else {
        set_changed_rect(canvas, x, y, w, h, width, frame.data()+y*width+x, previous[index].data()+y*width+x);
      }
      previous[index] = frame;
      led_canvas_set_pixels(reinterpret_cast<LedCanvas*>(reference), 0, 0, width, height, frame.data());
      const char *actual, *expected;
      size_t actual_size, expected_size;
      canvases[index]->Serialize(&actual, &actual_size);
      reference->Serialize(&expected, &expected_size);
      if (actual_size != expected_size || memcmp(actual, expected, actual_size)) {
        fprintf(stderr, "bitplane mismatch: bits=%d tick=%d rectangle=%d,%d %dx%d\n", bits, tick, x, y, w, h);
        delete matrix;
        return 1;
      }
      ++verified;
    }
    delete matrix;
  }
  printf("%u native bitplane comparisons passed, including RGB/BGR and brightness changes; no GPIO accessed.\n", verified);
}
