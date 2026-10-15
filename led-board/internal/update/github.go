package update

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/davwheat/raildotmatrix.co.uk/led-board/internal/version"
)

// DevelopmentTag names the single rolling prerelease that CI refreshes with every successful build on main.
const DevelopmentTag = "dev"

type Release struct {
	Tag         string         `json:"tag_name"`
	Name        string         `json:"name"`
	Body        string         `json:"body"`
	URL         string         `json:"html_url"`
	Draft       bool           `json:"draft"`
	Prerelease  bool           `json:"prerelease"`
	PublishedAt time.Time      `json:"published_at"`
	Assets      []ReleaseAsset `json:"assets"`
}

type ReleaseAsset struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	// Digest is GitHub's own "sha256:…" hash of the upload.
	Digest string `json:"digest"`
	URL    string `json:"browser_download_url"`
}

func (r Release) Asset(name string) (ReleaseAsset, bool) {
	for _, a := range r.Assets {
		if a.Name == name {
			return a, true
		}
	}
	return ReleaseAsset{}, false
}

type GitHub struct {
	API, Repo string
	Client    *http.Client
}

var errNoRelease = errors.New("there's no release yet")

// cachedResponse lets a later request send If-None-Match. GitHub doesn't count a 304 response against the
// 60 requests an hour that it allows each IP address without a token.
type cachedResponse struct {
	ETag string          `json:"etag"`
	Body json.RawMessage `json:"body"`
}

func (g *GitHub) get(ctx context.Context, path string, cache *cachedResponse) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(g.API, "/")+"/repos/"+g.Repo+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "raildotmatrix-departure-board/"+version.Version)
	if cache != nil && cache.ETag != "" {
		req.Header.Set("If-None-Match", cache.ETag)
	}
	resp, err := g.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	switch {
	case resp.StatusCode == http.StatusNotModified && cache != nil:
		return cache.Body, nil
	case resp.StatusCode == http.StatusNotFound:
		return nil, errNoRelease
	case resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests:
		return nil, errors.New("GitHub is limiting requests from this network; the board tries again later")
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("GitHub returned %s", resp.Status)
	}
	if cache != nil {
		*cache = cachedResponse{ETag: resp.Header.Get("ETag"), Body: body}
	}
	return body, nil
}

// LatestRelease finds the release a channel offers. A board on the prerelease channel takes the newest published
// release, whether or not it's a prerelease, so it's never behind a board on the stable channel.
func (g *GitHub) LatestRelease(ctx context.Context, channel string, cache *cachedResponse) (Release, error) {
	var path string
	switch channel {
	case Stable:
		path = "/releases/latest"
	case Prerelease:
		path = "/releases?per_page=10"
	case Development:
		path = "/releases/tags/" + DevelopmentTag
	default:
		return Release{}, fmt.Errorf("unknown update channel %q", channel)
	}
	body, err := g.get(ctx, path, cache)
	if err != nil {
		return Release{}, err
	}
	if channel != Prerelease {
		var r Release
		return r, json.Unmarshal(body, &r)
	}
	var releases []Release
	if err := json.Unmarshal(body, &releases); err != nil {
		return Release{}, err
	}
	for _, r := range releases {
		if !r.Draft && r.Tag != DevelopmentTag {
			return r, nil
		}
	}
	return Release{}, errNoRelease
}

type Commit struct {
	SHA     string `json:"sha"`
	Message string `json:"message"`
	URL     string `json:"url"`
}

// Commits lists the commits after base up to head, newest first, with only the first line of each message.
func (g *GitHub) Commits(ctx context.Context, base, head string) ([]Commit, error) {
	body, err := g.get(ctx, "/compare/"+base+"..."+head, nil)
	if err != nil {
		return nil, err
	}
	var result struct {
		Commits []struct {
			SHA    string `json:"sha"`
			URL    string `json:"html_url"`
			Commit struct {
				Message string `json:"message"`
			} `json:"commit"`
		} `json:"commits"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	commits := make([]Commit, 0, len(result.Commits))
	for i := len(result.Commits) - 1; i >= 0; i-- {
		c := result.Commits[i]
		title, _, _ := strings.Cut(c.Commit.Message, "\n")
		commits = append(commits, Commit{SHA: c.SHA, Message: title, URL: c.URL})
	}
	return commits, nil
}

// Download fetches a release asset, refusing anything longer than limit bytes.
func (g *GitHub) Download(ctx context.Context, url string, limit int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/octet-stream")
	req.Header.Set("User-Agent", "raildotmatrix-departure-board/"+version.Version)
	resp, err := g.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download %s: %s", url, resp.Status)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("download %s is larger than expected", url)
	}
	return data, nil
}
