# Cross-compiles the board for the Raspberry Pi Zero 2 W from macOS.
# See docs/build.md.

ZIG_TARGET ?= aarch64-linux-gnu.2.41
CC  := zig cc -target $(ZIG_TARGET)
CXX := zig c++ -target $(ZIG_TARGET)
AR  := zig ar

PI_HOST ?= root@10.0.1.146
SSH_OPTS := -o ControlPath=/Users/david/.ssh/cm-pi -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no
SSH := ssh $(SSH_OPTS)
# The Pi's minimal image has neither scp nor sftp-server, so files are
# streamed through a plain ssh session instead. Usage: $(call push,src,dest)
define push
$(SSH) $(PI_HOST) 'cat > $(2).tmp && chmod 755 $(2).tmp && mv -f $(2).tmp $(2)' < $(1)
endef

LIB_SRC := third_party/rpi-rgb-led-matrix/lib
LIB_INC := third_party/rpi-rgb-led-matrix/include
BUILD   := build
OBJ_DIR := $(BUILD)/obj
LIB     := $(BUILD)/lib/librgbmatrix.a

# Mirrors OBJECTS in $(LIB_SRC)/Makefile. The archive is linked statically, so
# objects the Go binding never references cost nothing at link time.
LIB_OBJECTS := gpio.o led-matrix.o options-initialize.o framebuffer.o \
	thread.o bdf-font.o graphics.o led-matrix-c.o hardware-mapping.o \
	pixel-mapper.o multiplex-mappers.o frame-sequence.o \
	content-streamer.o content-streamer-c.o frame-sequence-c.o \
	rp1/rp1_pio_backend.o rp1/rp1_pio_support.o rp1/rp1_rio_backend.o
OBJECTS := $(addprefix $(OBJ_DIR)/,$(LIB_OBJECTS))

RP1_PIO_VENDOR := $(LIB_SRC)/rp1/rp1_pio_vendor
LIB_DEFINES := -DDEFAULT_HARDWARE='"regular"'
LIB_CFLAGS := -W -Wall -Wextra -Wno-unused-parameter -O3 \
	-I$(LIB_INC) -I$(RP1_PIO_VENDOR)/piolib/include -I$(RP1_PIO_VENDOR)/include \
	$(LIB_DEFINES)
LIB_CXXFLAGS := $(LIB_CFLAGS) -fno-exceptions -std=c++11

GO_ENV := CGO_ENABLED=1 GOOS=linux GOARCH=arm64 CC="$(CC)" CXX="$(CXX)"
# -extldflags=-s makes the external (zig) linker strip too; without it the
# binary keeps libc++ debug info and is nearly four times larger.
GO_BUILD := $(GO_ENV) go build -trimpath -ldflags="-s -w -extldflags=-s"

.PHONY: all lib board panel-test deploy install-service deploy-panel-test run-panel-test clean

all: board

lib: $(LIB)

$(LIB): $(OBJECTS)
	@mkdir -p $(dir $@)
	$(AR) rcs $@ $^

$(OBJ_DIR)/%.o: $(LIB_SRC)/%.cc
	@mkdir -p $(dir $@)
	$(CXX) $(LIB_CXXFLAGS) -c -o $@ $<

$(OBJ_DIR)/%.o: $(LIB_SRC)/%.c
	@mkdir -p $(dir $@)
	$(CC) $(LIB_CFLAGS) -c -o $@ $<

board: $(LIB)
	$(GO_BUILD) -o $(BUILD)/board ./cmd/board

panel-test: $(LIB)
	$(GO_BUILD) -o $(BUILD)/panel-test ./cmd/panel-test

deploy: board
	$(call push,$(BUILD)/board,/root/board)
	$(SSH) $(PI_HOST) 'systemctl try-restart departure-board'

# Installs and starts the systemd unit. The config file is installed only if
# there isn't one, so the Pi's own settings survive.
install-service:
	$(SSH) $(PI_HOST) 'cat > /etc/systemd/system/departure-board.service' < deploy/departure-board.service
	$(SSH) $(PI_HOST) 'test -e /etc/departure-board.toml || { cat > /etc/departure-board.toml && chmod 644 /etc/departure-board.toml; }' < deploy/departure-board.toml
	$(SSH) $(PI_HOST) 'systemctl daemon-reload && systemctl enable --now departure-board'

deploy-panel-test: panel-test
	$(call push,$(BUILD)/panel-test,/root/panel-test)

# Runs the deployed panel-test for five seconds and samples CPU use while it
# draws.
run-panel-test:
	$(SSH) $(PI_HOST) 'timeout 10 /root/panel-test -seconds 5 & sleep 2.5; top -bn1 | head -15; wait'

clean:
	rm -rf $(BUILD)
