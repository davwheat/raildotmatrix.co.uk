package live

import (
	"errors"
	"fmt"
	"time"

	"github.com/aperturerobotics/protobuf-go-lite/types/known/timestamppb"
	"github.com/davwheat/led-departure-board/internal/live/pb"
)

// ErrUnsupportedVersion is returned for a frame from a service speaking another protocol version.
var ErrUnsupportedVersion = errors.New("live: unsupported stream version")

// An enum value this build doesn't know came from a newer service. Each falls back to the reading that claims
// least: evidence that proves nothing, a train nobody identified.
var (
	announcementTypes = map[pb.AnnouncementType]string{
		pb.AnnouncementType_ANNOUNCEMENT_TYPE_NEXT:                "next",
		pb.AnnouncementType_ANNOUNCEMENT_TYPE_APPROACHING:         "approaching",
		pb.AnnouncementType_ANNOUNCEMENT_TYPE_STANDING:            "standing",
		pb.AnnouncementType_ANNOUNCEMENT_TYPE_DISRUPTED:           "disrupted",
		pb.AnnouncementType_ANNOUNCEMENT_TYPE_PASSING:             "passing",
		pb.AnnouncementType_ANNOUNCEMENT_TYPE_PLATFORM_ALTERATION: "platform_alteration",
	}
	movementKinds = map[pb.MovementKind]MovementKind{
		pb.MovementKind_MOVEMENT_KIND_STOP:      KindStop,
		pb.MovementKind_MOVEMENT_KIND_ARRIVAL:   KindArrival,
		pb.MovementKind_MOVEMENT_KIND_DEPARTURE: KindDeparture,
		pb.MovementKind_MOVEMENT_KIND_PASSING:   KindPassing,
		pb.MovementKind_MOVEMENT_KIND_UNKNOWN:   KindUnknown,
	}
	transportModes = map[pb.TransportMode]TransportMode{
		pb.TransportMode_TRANSPORT_MODE_TRAIN: ModeTrain,
		pb.TransportMode_TRANSPORT_MODE_BUS:   ModeBus,
		pb.TransportMode_TRANSPORT_MODE_FERRY: ModeFerry,
	}
	tdEvents = map[pb.TdEvent]string{
		pb.TdEvent_TD_EVENT_ARRIVAL:   "arrival",
		pb.TdEvent_TD_EVENT_DEPARTURE: "departure",
		pb.TdEvent_TD_EVENT_PLATFORM:  "platform",
	}
	tdMatches = map[pb.TdMatch]string{
		pb.TdMatch_TD_MATCH_MATCHED:   "matched",
		pb.TdMatch_TD_MATCH_UNMATCHED: "unmatched",
		pb.TdMatch_TD_MATCH_AMBIGUOUS: "ambiguous",
	}
	tdClassifications = map[pb.TdClassification]string{
		pb.TdClassification_TD_CLASSIFICATION_STOPPING:      "stopping",
		pb.TdClassification_TD_CLASSIFICATION_PASSING:       "passing",
		pb.TdClassification_TD_CLASSIFICATION_NON_PASSENGER: "non_passenger",
		pb.TdClassification_TD_CLASSIFICATION_NON_PUBLIC:    "non_public",
		pb.TdClassification_TD_CLASSIFICATION_UNKNOWN:       "unknown",
		pb.TdClassification_TD_CLASSIFICATION_AMBIGUOUS:     "ambiguous",
	}
)

// Decode reads one binary frame. It returns a nil message for a payload a newer service added, which is ignored
// rather than fatal: the frame still proves the connection is alive.
func Decode(frame []byte) (Message, error) {
	var wire pb.ServerMessage
	if err := wire.UnmarshalVT(frame); err != nil {
		return nil, fmt.Errorf("live: decoding frame: %w", err)
	}
	if wire.GetVersion() != ProtocolVersion {
		return nil, fmt.Errorf("%w %d", ErrUnsupportedVersion, wire.GetVersion())
	}
	switch payload := wire.GetPayload().(type) {
	case *pb.ServerMessage_Snapshot:
		value := payload.Snapshot
		return &Snapshot{
			Version:   ProtocolVersion,
			Type:      "snapshot",
			RequestID: value.RequestId,
			Station:   location(value.GetStation()),
			Window:    window(value.GetWindow()),
			Epoch:     value.GetEpoch(),
			Revision:  value.GetRevision(),
			Movements: movements(value.GetMovements()),
			Ordering:  stringList(value.GetOrdering()),
			Overrides: overrides(value.GetOverrides()),
		}, nil
	case *pb.ServerMessage_Update:
		value := payload.Update
		removals := make([]OverrideRemoval, len(value.GetOverrideRemovals()))
		for i, removal := range value.GetOverrideRemovals() {
			removals[i] = OverrideRemoval{ID: removal.GetId(), Reason: removal.GetReason()}
		}
		return &Update{
			Version:          ProtocolVersion,
			Type:             "update",
			Epoch:            value.GetEpoch(),
			PreviousRevision: value.GetPreviousRevision(),
			Revision:         value.GetRevision(),
			Window:           window(value.GetWindow()),
			Upserts:          movements(value.GetUpserts()),
			Removals:         stringList(value.GetRemovals()),
			Ordering:         stringList(value.GetOrdering()),
			OverrideUpserts:  overrides(value.GetOverrideUpserts()),
			OverrideRemovals: removals,
		}, nil
	case *pb.ServerMessage_Heartbeat:
		value := payload.Heartbeat
		return &Heartbeat{
			Version:  ProtocolVersion,
			Type:     "heartbeat",
			Epoch:    value.GetEpoch(),
			Revision: value.GetRevision(),
			Digest:   value.GetDigest(),
			SentAt:   instant(value.GetSentAt()),
		}, nil
	case *pb.ServerMessage_Ready:
		value := payload.Ready
		return &Ready{
			Version:   ProtocolVersion,
			Type:      "ready",
			Station:   location(value.GetStation()),
			CreatedAt: instant(value.GetCreatedAt()),
			Healthy:   value.GetHealthy(),
		}, nil
	case *pb.ServerMessage_Announcement:
		value := payload.Announcement
		announcementType, known := announcementTypes[value.GetAnnouncementType()]
		if !known {
			return nil, nil
		}
		return &Announcement{
			Version:           ProtocolVersion,
			Type:              "announcement",
			EventID:           value.GetEventId(),
			MovementID:        value.GetMovementId(),
			Station:           location(value.GetStation()),
			AnnouncementType:  announcementType,
			CreatedAt:         instant(value.GetCreatedAt()),
			ExpiresAt:         instant(value.GetExpiresAt()),
			Details:           movement(value.GetDetails()),
			AffectedPlatforms: stringList(value.GetAffectedPlatforms()),
			PreviousPlatform:  value.PreviousPlatform,
			NewPlatform:       value.NewPlatform,
			Audio:             audio(value.GetAudio()),
		}, nil
	case *pb.ServerMessage_Retraction:
		value := payload.Retraction
		announcementType, known := announcementTypes[value.GetAnnouncementType()]
		if !known {
			return nil, nil
		}
		return &Retraction{
			Version:           ProtocolVersion,
			Type:              "retraction",
			EventID:           value.GetEventId(),
			MovementID:        value.GetMovementId(),
			AnnouncementType:  announcementType,
			Reason:            value.GetReason(),
			Cause:             value.Cause,
			CreatedAt:         instant(value.GetCreatedAt()),
			AffectedPlatforms: stringList(value.GetAffectedPlatforms()),
		}, nil
	case *pb.ServerMessage_Revision:
		value := payload.Revision
		announcementType, known := announcementTypes[value.GetAnnouncementType()]
		if !known {
			return nil, nil
		}
		return &Revision{
			Version:           ProtocolVersion,
			Type:              "revision",
			EventID:           value.GetEventId(),
			MovementID:        value.GetMovementId(),
			AnnouncementType:  announcementType,
			CreatedAt:         instant(value.GetCreatedAt()),
			ExpiresAt:         instant(value.GetExpiresAt()),
			Details:           movement(value.GetDetails()),
			AffectedPlatforms: stringList(value.GetAffectedPlatforms()),
			Audio:             audio(value.GetAudio()),
		}, nil
	default:
		return nil, nil
	}
}

// EncodeResync builds the frame that asks the service for an authoritative snapshot.
func EncodeResync() []byte {
	frame, err := (&pb.ClientMessage{Command: &pb.ClientMessage_Resync{Resync: &pb.Resync{}}}).MarshalVT()
	if err != nil {
		panic(fmt.Sprintf("live: encoding resync: %v", err))
	}
	return frame
}

// instant reads a timestamp the service always sets. A missing one reads as the zero time rather than the epoch.
func instant(value *timestamppb.Timestamp) time.Time {
	if value == nil {
		return time.Time{}
	}
	return value.AsTime()
}

func optionalInstant(value *timestamppb.Timestamp) *time.Time {
	if value == nil {
		return nil
	}
	t := value.AsTime()
	return &t
}

// stringList copies a repeated field so that an absent list is a known-empty one, never nil.
func stringList(values []string) []string {
	return append([]string{}, values...)
}

func location(value *pb.Location) Location {
	if value == nil {
		return Location{}
	}
	return Location{TPL: value.GetTpl(), CRS: value.Crs, Name: value.Name}
}

func optionalLocation(value *pb.Location) *Location {
	if value == nil {
		return nil
	}
	l := location(value)
	return &l
}

func times(value *pb.Times) Times {
	return Times{
		Planned:      optionalInstant(value.GetPlanned()),
		Estimated:    optionalInstant(value.GetEstimated()),
		Actual:       optionalInstant(value.GetActual()),
		UnknownDelay: value.GetUnknownDelay(),
	}
}

func platform(value *pb.Platform) Platform {
	if value == nil {
		return Platform{}
	}
	return Platform{Number: value.Number, Confirmed: value.Confirmed, Suppressed: value.Suppressed, Source: value.Source}
}

func reason(value *pb.Reason) Reason {
	if value == nil {
		return Reason{}
	}
	return Reason{Code: value.Code, Text: value.Text}
}

func window(value *pb.Window) Window {
	return Window{From: instant(value.GetFrom()), To: instant(value.GetTo())}
}

func endpoints(values []*pb.Endpoint) []Endpoint {
	out := make([]Endpoint, len(values))
	for i, value := range values {
		out[i] = Endpoint{Location: location(value.GetLocation()), AssocRID: value.AssocRid, AssocCat: value.AssocCat}
		if via := value.GetVia(); via != nil {
			out[i].Via = &Via{Text: via.GetText(), Locs: stringList(via.GetLocs())}
		}
	}
	return out
}

func calls(values []*pb.Call) []Call {
	out := make([]Call, len(values))
	for i, value := range values {
		out[i] = Call{
			ID:               value.GetId(),
			Location:         location(value.GetLocation()),
			Arrival:          times(value.GetArrival()),
			Departure:        times(value.GetDeparture()),
			Platform:         platform(value.GetPlatform()),
			Cancelled:        value.GetCancelled(),
			Activities:       value.Activities,
			Operational:      value.GetOperational(),
			DetachFront:      value.DetachFront,
			FalseDestination: optionalLocation(value.GetFalseDestination()),
			CoachCount:       value.CoachCount,
		}
	}
	return out
}

func portions(values []*pb.Portion) []Portion {
	out := make([]Portion, len(values))
	for i, value := range values {
		out[i] = Portion{
			Headcode:     value.Headcode,
			OperatorCode: value.OperatorCode,
			OperatorName: value.OperatorName,
			Origin:       optionalLocation(value.GetOrigin()),
			Destination:  optionalLocation(value.GetDestination()),
			RID:          value.GetRid(),
			Category:     value.GetCategory(),
			At:           location(value.GetAt()),
			Cancelled:    value.GetCancelled(),
			Available:    value.GetAvailable(),
			CoachCount:   value.CoachCount,
			Position:     value.Position,
			Calls:        calls(value.GetCalls()),
		}
		if mode, known := transportModes[value.GetMode()]; known {
			out[i].Mode = &mode
		}
	}
	return out
}

func coaches(value *pb.CoachList) []Coach {
	if value == nil {
		return nil
	}
	out := make([]Coach, len(value.GetCoaches()))
	for i, coach := range value.GetCoaches() {
		out[i] = Coach{
			Number:         coach.GetNumber(),
			Class:          coach.Class,
			ToiletType:     coach.ToiletType,
			ToiletStatus:   coach.ToiletStatus,
			LoadingPercent: coach.LoadingPercent,
		}
	}
	return out
}

func td(value *pb.TdEvidence) *TDMovement {
	if value == nil {
		return nil
	}
	evidence := &TDMovement{
		ID:             value.GetId(),
		Area:           value.GetArea(),
		Description:    value.GetDescription(),
		From:           value.GetFrom(),
		To:             value.GetTo(),
		Stanox:         value.GetStanox(),
		CRS:            value.GetCrs(),
		Tiplocs:        stringList(value.GetTiplocs()),
		Name:           value.GetName(),
		Platform:       value.GetPlatform(),
		Event:          "platform",
		Step:           value.GetStep(),
		Direction:      value.GetDirection(),
		FromLine:       value.GetFromLine(),
		ToLine:         value.GetToLine(),
		ObservedAt:     instant(value.GetObservedAt()),
		ReportedAt:     instant(value.GetReportedAt()),
		ExpiresAt:      instant(value.GetExpiresAt()),
		Match:          "unmatched",
		Classification: "unknown",
	}
	if event, known := tdEvents[value.GetEvent()]; known {
		evidence.Event = event
	}
	if match, known := tdMatches[value.GetMatch()]; known {
		evidence.Match = match
	}
	if classification, known := tdClassifications[value.GetClassification()]; known {
		evidence.Classification = classification
	}
	return evidence
}

func movement(value *pb.Movement) Movement {
	if value == nil {
		value = &pb.Movement{}
	}
	decoded := Movement{
		ID:               value.GetId(),
		RID:              value.GetRid(),
		LocationID:       value.GetLocationId(),
		Station:          location(value.GetStation()),
		Kind:             KindUnknown,
		UID:              value.Uid,
		Headcode:         value.Headcode,
		OperatorCode:     value.OperatorCode,
		OperatorName:     value.OperatorName,
		Mode:             ModeTrain,
		Passenger:        value.GetPassenger(),
		Operational:      value.GetOperational(),
		Arrival:          times(value.GetArrival()),
		Departure:        times(value.GetDeparture()),
		Passing:          times(value.GetPassing()),
		Platform:         platform(value.GetPlatform()),
		Suppressed:       value.GetSuppressed(),
		Cancelled:        value.GetCancelled(),
		CancelReason:     reason(value.GetCancelReason()),
		DelayReason:      reason(value.GetDelayReason()),
		CoachCount:       value.CoachCount,
		LoadingPercent:   value.LoadingPercent,
		LoadingCategory:  value.LoadingCategory,
		Formation:        value.Formation,
		CoachLoading:     value.CoachLoading,
		Coaches:          coaches(value.GetCoaches()),
		ReverseFormation: value.ReverseFormation,
		DetachFront:      value.DetachFront,
		Activities:       value.Activities,
		FalseDestination: optionalLocation(value.GetFalseDestination()),
		Origins:          endpoints(value.GetOrigins()),
		Destinations:     endpoints(value.GetDestinations()),
		CallingPoints:    calls(value.GetCallingPoints()),
		Portions:         portions(value.GetPortions()),
		ArrivedAt:        optionalInstant(value.GetArrivedAt()),
		PassedAt:         optionalInstant(value.GetPassedAt()),
		TD:               td(value.GetTd()),
	}
	if kind, known := movementKinds[value.GetKind()]; known {
		decoded.Kind = kind
	}
	if mode, known := transportModes[value.GetMode()]; known {
		decoded.Mode = mode
	}
	if order := value.GetTrainOrder(); order != nil {
		decoded.TrainOrder = &TrainOrder{
			Position:  order.GetPosition(),
			Platform:  order.GetPlatform(),
			UpdatedAt: instant(order.GetUpdatedAt()),
		}
	}
	return decoded
}

func movements(values []*pb.Movement) []Movement {
	out := make([]Movement, len(values))
	for i, value := range values {
		out[i] = movement(value)
	}
	return out
}

func overrides(values []*pb.PlatformOverride) []PlatformOverride {
	out := make([]PlatformOverride, len(values))
	for i, value := range values {
		out[i] = PlatformOverride{
			ID:          value.GetId(),
			Kind:        NotForPublicUse,
			Station:     location(value.GetStation()),
			Platform:    value.GetPlatform(),
			MovementID:  value.MovementId,
			ActivatesAt: instant(value.GetActivatesAt()),
			ExpiresAt:   instant(value.GetExpiresAt()),
			Reason:      value.GetReason(),
			Source:      value.GetSource(),
		}
		// Dropping an override this build can't name would break the state digest, which counts it.
		if value.GetKind() == pb.OverrideKind_OVERRIDE_KIND_STAND_CLEAR {
			out[i].Kind = StandClear
		}
	}
	return out
}

// Audio in a codec this build can't play is no audio: the announcement is generated instead.
func audio(value *pb.AnnouncementAudio) *AnnouncementAudio {
	if value == nil || value.GetCodec() != pb.AudioCodec_AUDIO_CODEC_MP3 || len(value.GetData()) == 0 {
		return nil
	}
	return &AnnouncementAudio{Codec: "mp3", Data: value.GetData(), Duration: value.GetDuration().AsDuration()}
}
