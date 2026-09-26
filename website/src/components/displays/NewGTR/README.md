# Useful info

- Destination "pages" cycle every 3s
  - E.g., "Bedford" and "via St. Pancras Intl" swap every 3s
- 2nd/3rd departures cycle approx. every 12-13s?
- "Calling at:" is fixed in place when displayed, and is the same width as the ordinal + scheduled departure

The settings panel can replace the first ordinal with a platform box for any platform selection. With one requested platform the box is fixed;
otherwise it follows the first service, leaving an unknown platform blank. The normal-font "Plat" label and larger platform number are centred as
a group, slightly above the box centre, with six blank dot rows between them. The platform number uses the "Large Platform Number" glyphs from
`led-board/internal/font/fonts/infotec-platform.yaff`, which omits the shared blank top row of the original capture. A two-dot gap separates the box from the service information. Known websocket coach
counts produce a train formation with a filled cab stepping sideways once every two rows and rounded corners only at the rear end. The cab
extends ahead of the first coach, leaving every hollow coach body the same width.

With a platform box, "Align lower service row with platform box" defaults to on: every service shares the same time and destination columns, and
the lower prefix is centred beneath the box. Turn it off to restore the lower row's original columns and left-aligned prefix.

The platform box stays fully lit when the outgoing and incoming trains use the same platform. A different platform fades in with its service.
