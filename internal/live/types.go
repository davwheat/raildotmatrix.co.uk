package live

import "time"

// The stream messages as the board reads them. A nil pointer means the service doesn't know the value, which is
// what protocol version 1 wrote as null. The JSON tags reproduce that form, which is how the service's fixtures
// record each message.

// ProtocolVersion is the only stream version this client reads.
const ProtocolVersion = 2

// Location is a named place on the railway.
type Location struct {
	TPL  string  `json:"tpl"`
	CRS  *string `json:"crs"`
	Name *string `json:"name"`
}

// Times is one of a movement's arrival, departure, or passing forecasts.
type Times struct {
	Planned   *time.Time `json:"planned"`
	Estimated *time.Time `json:"estimated"`
	Actual    *time.Time `json:"actual"`
	// UnknownDelay is Darwin's "delayed" with no estimate. It can coexist with a working estimate.
	UnknownDelay bool `json:"unknown_delay"`
}

// Platform is Darwin's platform assertion. Confirmation and suppression are tri-state.
type Platform struct {
	Number     *string `json:"number"`
	Confirmed  *bool   `json:"confirmed"`
	Suppressed *bool   `json:"suppressed"`
	Source     *string `json:"source"`
}

// Reason is a cancellation or delay reason. Text is nil when only a code is known.
type Reason struct {
	Code *string `json:"code"`
	Text *string `json:"text"`
}

// Via is a destination's "via X" caption.
type Via struct {
	Text string   `json:"text"`
	Locs []string `json:"locs"`
}

// Endpoint is an origin or destination. An associated portion's endpoint carries the portion's RID.
type Endpoint struct {
	Location
	Via      *Via    `json:"via"`
	AssocRID *string `json:"assoc_rid"`
	AssocCat *string `json:"assoc_cat"`
}

// Call is one location in a calling pattern.
type Call struct {
	ID string `json:"id"`
	Location
	Arrival          Times     `json:"arrival"`
	Departure        Times     `json:"departure"`
	Platform         Platform  `json:"platform"`
	Cancelled        bool      `json:"cancelled"`
	Activities       *string   `json:"activities"`
	Operational      bool      `json:"operational"`
	DetachFront      *bool     `json:"detach_front"`
	FalseDestination *Location `json:"false_destination"`
	CoachCount       *int32    `json:"coach_count"`
}

// TransportMode is a movement's mode of transport.
type TransportMode string

const (
	ModeTrain TransportMode = "train"
	ModeBus   TransportMode = "bus"
	ModeFerry TransportMode = "ferry"
)

// Portion is a service that joins or divides from a movement's train.
type Portion struct {
	Headcode     *string        `json:"headcode"`
	Mode         *TransportMode `json:"mode"`
	OperatorCode *string        `json:"operator_code"`
	OperatorName *string        `json:"operator_name"`
	Origin       *Location      `json:"origin"`
	Destination  *Location      `json:"destination"`
	RID          string         `json:"rid"`
	// Category is Darwin's association category: "JJ" joins, "VV" divides.
	Category   string   `json:"category"`
	At         Location `json:"at"`
	Cancelled  bool     `json:"cancelled"`
	Available  bool     `json:"available"`
	CoachCount *int32   `json:"coach_count"`
	Position   *string  `json:"position"`
	Calls      []Call   `json:"calls"`
}

// Coach is one vehicle of a known formation.
type Coach struct {
	Number         string  `json:"number"`
	Class          *string `json:"class"`
	ToiletType     *string `json:"toilet_type"`
	ToiletStatus   *string `json:"toilet_status"`
	LoadingPercent *int32  `json:"loading_percent"`
}

// MovementKind says what the train does at the station.
type MovementKind string

const (
	KindStop      MovementKind = "stop"
	KindArrival   MovementKind = "arrival"
	KindDeparture MovementKind = "departure"
	KindPassing   MovementKind = "passing"
	// KindUnknown is a train known only from signalling.
	KindUnknown MovementKind = "unknown"
)

// TrainOrder is the position Darwin's TrainOrder gives a movement on its platform.
type TrainOrder struct {
	Position  int32     `json:"position"`
	Platform  string    `json:"platform"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TDMovement is signalling evidence attached to a movement. It's separate from Darwin's forecasts.
type TDMovement struct {
	ID          string   `json:"id"`
	Area        string   `json:"area"`
	Description string   `json:"description"`
	From        string   `json:"from"`
	To          string   `json:"to"`
	Stanox      string   `json:"stanox"`
	CRS         string   `json:"crs"`
	Tiplocs     []string `json:"tiplocs"`
	Name        string   `json:"name"`
	Platform    string   `json:"platform"`
	// Event is "arrival", "departure", or "platform" for a platform-only SMART rule.
	Event          string    `json:"event"`
	Step           string    `json:"step"`
	Direction      string    `json:"direction"`
	FromLine       string    `json:"from_line"`
	ToLine         string    `json:"to_line"`
	ObservedAt     time.Time `json:"observed_at"`
	ReportedAt     time.Time `json:"reported_at"`
	ExpiresAt      time.Time `json:"expires_at"`
	Match          string    `json:"match"`
	Classification string    `json:"classification"`
}

// Movement is one visit by one train to the station. Its ID keeps separate visits by the same RID apart.
type Movement struct {
	ID               string        `json:"id"`
	RID              string        `json:"rid"`
	LocationID       string        `json:"location_id"`
	Station          Location      `json:"station"`
	Kind             MovementKind  `json:"kind"`
	UID              *string       `json:"uid"`
	Headcode         *string       `json:"headcode"`
	OperatorCode     *string       `json:"operator_code"`
	OperatorName     *string       `json:"operator_name"`
	Mode             TransportMode `json:"mode"`
	Passenger        bool          `json:"passenger"`
	Operational      bool          `json:"operational"`
	Arrival          Times         `json:"arrival"`
	Departure        Times         `json:"departure"`
	Passing          Times         `json:"passing"`
	Platform         Platform      `json:"platform"`
	Suppressed       bool          `json:"suppressed"`
	Cancelled        bool          `json:"cancelled"`
	CancelReason     Reason        `json:"cancel_reason"`
	DelayReason      Reason        `json:"delay_reason"`
	CoachCount       *int32        `json:"coach_count"`
	LoadingPercent   *int32        `json:"loading_percent"`
	LoadingCategory  *string       `json:"loading_category"`
	Formation        *string       `json:"formation"`
	CoachLoading     *string       `json:"coach_loading"`
	Coaches          []Coach       `json:"coaches"`
	ReverseFormation *bool         `json:"reverse_formation"`
	DetachFront      *bool         `json:"detach_front"`
	Activities       *string       `json:"activities"`
	FalseDestination *Location     `json:"false_destination"`
	Origins          []Endpoint    `json:"origins"`
	Destinations     []Endpoint    `json:"destinations"`
	CallingPoints    []Call        `json:"calling_points"`
	Portions         []Portion     `json:"portions"`
	// ArrivedAt is signalling evidence that the train is at the platform. It never becomes Arrival.Actual.
	ArrivedAt  *time.Time  `json:"arrived_at"`
	PassedAt   *time.Time  `json:"passed_at"`
	TrainOrder *TrainOrder `json:"train_order,omitempty"`
	TD         *TDMovement `json:"td,omitempty"`
}

// OverrideKind is the warning a platform override shows.
type OverrideKind string

const (
	StandClear      OverrideKind = "stand_clear"
	NotForPublicUse OverrideKind = "not_for_public_use"
)

// PlatformOverride replaces a platform's train list with a warning while it's active.
type PlatformOverride struct {
	ID          string       `json:"id"`
	Kind        OverrideKind `json:"kind"`
	Station     Location     `json:"station"`
	Platform    string       `json:"platform"`
	MovementID  *string      `json:"movement_id"`
	ActivatesAt time.Time    `json:"activates_at"`
	ExpiresAt   time.Time    `json:"expires_at"`
	Reason      string       `json:"reason"`
	Source      string       `json:"source"`
}

// OverrideRemoval withdraws an override by ID.
type OverrideRemoval struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

// Window is the half-open time range a state covers.
type Window struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

// Message is any decoded server message. The concrete types are Snapshot, Update, Heartbeat, Ready,
// Announcement, Retraction, and Revision.
type Message interface {
	messageType() string
}

// Snapshot is the complete state of the stream's view.
type Snapshot struct {
	Version   int                `json:"version"`
	Type      string             `json:"type"`
	RequestID *string            `json:"request_id,omitempty"`
	Station   Location           `json:"station"`
	Window    Window             `json:"window"`
	Epoch     string             `json:"epoch"`
	Revision  uint64             `json:"revision"`
	Movements []Movement         `json:"movements"`
	Ordering  []string           `json:"ordering"`
	Overrides []PlatformOverride `json:"overrides"`
}

// Update is a delta from PreviousRevision to Revision within one epoch.
type Update struct {
	Version          int                `json:"version"`
	Type             string             `json:"type"`
	Epoch            string             `json:"epoch"`
	PreviousRevision uint64             `json:"previous_revision"`
	Revision         uint64             `json:"revision"`
	Window           Window             `json:"window"`
	Upserts          []Movement         `json:"upserts"`
	Removals         []string           `json:"removals"`
	Ordering         []string           `json:"ordering"`
	OverrideUpserts  []PlatformOverride `json:"override_upserts"`
	OverrideRemovals []OverrideRemoval  `json:"override_removals"`
}

// Heartbeat attests the state the service holds for this connection.
type Heartbeat struct {
	Version  int       `json:"version"`
	Type     string    `json:"type"`
	Epoch    string    `json:"epoch,omitempty"`
	Revision uint64    `json:"revision,omitempty"`
	Digest   string    `json:"digest,omitempty"`
	SentAt   time.Time `json:"sent_at"`
}

// Ready opens an announcement stream. The CIS stream never sends it.
type Ready struct {
	Version   int       `json:"version"`
	Type      string    `json:"type"`
	Station   Location  `json:"station"`
	CreatedAt time.Time `json:"created_at"`
	Healthy   bool      `json:"healthy"`
}

// AnnouncementAudio is a rendered announcement, chime included.
type AnnouncementAudio struct {
	Codec string `json:"codec"`
	Data  []byte `json:"data"`
	// Duration is zero when the renderer didn't measure it.
	Duration time.Duration `json:"duration,omitempty"`
}

// Announcement is an announcement stream trigger. The CIS stream never sends it.
type Announcement struct {
	Version           int                `json:"version"`
	Type              string             `json:"type"`
	EventID           string             `json:"event_id"`
	MovementID        string             `json:"movement_id"`
	Station           Location           `json:"station"`
	AnnouncementType  string             `json:"announcement_type"`
	CreatedAt         time.Time          `json:"created_at"`
	ExpiresAt         time.Time          `json:"expires_at"`
	Details           Movement           `json:"details"`
	AffectedPlatforms []string           `json:"affected_platforms"`
	PreviousPlatform  *string            `json:"previous_platform"`
	NewPlatform       *string            `json:"new_platform"`
	Audio             *AnnouncementAudio `json:"audio,omitempty"`
}

// Retraction withdraws an announcement. The CIS stream never sends it.
type Retraction struct {
	Version           int       `json:"version"`
	Type              string    `json:"type"`
	EventID           string    `json:"event_id"`
	MovementID        string    `json:"movement_id"`
	AnnouncementType  string    `json:"announcement_type"`
	Reason            string    `json:"reason"`
	Cause             *string   `json:"cause,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	AffectedPlatforms []string  `json:"affected_platforms"`
}

// Revision replaces an announcement's details. The CIS stream never sends it.
type Revision struct {
	Version           int                `json:"version"`
	Type              string             `json:"type"`
	EventID           string             `json:"event_id"`
	MovementID        string             `json:"movement_id"`
	AnnouncementType  string             `json:"announcement_type"`
	CreatedAt         time.Time          `json:"created_at"`
	ExpiresAt         time.Time          `json:"expires_at"`
	Details           Movement           `json:"details"`
	AffectedPlatforms []string           `json:"affected_platforms"`
	Audio             *AnnouncementAudio `json:"audio,omitempty"`
}

func (*Snapshot) messageType() string     { return "snapshot" }
func (*Update) messageType() string       { return "update" }
func (*Heartbeat) messageType() string    { return "heartbeat" }
func (*Ready) messageType() string        { return "ready" }
func (*Announcement) messageType() string { return "announcement" }
func (*Retraction) messageType() string   { return "retraction" }
func (*Revision) messageType() string     { return "revision" }
