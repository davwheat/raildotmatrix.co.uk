package font

//go:generate python3 ../../scripts/import-platform-font.py ../../../tools/font.json infotec_platform_gen.go
//go:generate python3 ../../scripts/import-compact-font.py ../../../tools/font.json infotec_small_gen.go
//go:generate python3 ../../scripts/import-clock-fonts.py ../../../tools/font.json infotec_clocks_gen.go
//go:generate python3 ../../scripts/import-compact-font.py ../../../tools/font.json infotec_formation_gen.go "Small formation contents" InfotecFormation 9 8
