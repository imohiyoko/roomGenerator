package main

// Project represents the metadata for a project.
type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	UpdatedAt string `json:"updatedAt"`
}

// Vec2 represents a 2D vector or point.
type Vec2 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Point represents a vertex in a polygon or path, including control handles for curves.
type Point struct {
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	H1      Vec2    `json:"h1"`
	H2      Vec2    `json:"h2"`
	IsCurve bool    `json:"isCurve"`
	// Handles is an optional array of control points (currently unused in legacy but kept for compatibility/future).
	Handles []Vec2 `json:"handles,omitempty"`
}

// Entity represents a geometric shape or object within an asset.
// It uses a union-like structure to support multiple shape types (polygon, circle, etc.).
type Entity struct {
	Type  string `json:"type"`  // "polygon", "circle", "ellipse", "arc", "text", etc.
	Layer string `json:"layer"` // "default", "0", etc.
	Color string `json:"color"`

	// Polygon specific
	Points []Point `json:"points,omitempty"`

	// Circle / Ellipse / Arc specific
	CX         *float64 `json:"cx,omitempty"`         // Center X
	CY         *float64 `json:"cy,omitempty"`         // Center Y
	RX         *float64 `json:"rx,omitempty"`         // Radius X
	RY         *float64 `json:"ry,omitempty"`         // Radius Y
	StartAngle *float64 `json:"startAngle,omitempty"` // For Arcs/Sectors
	EndAngle   *float64 `json:"endAngle,omitempty"`   // For Arcs/Sectors
	ArcMode    string   `json:"arcMode,omitempty"`    // "sector", "chord", etc.
	Rotation   *float64 `json:"rotation,omitempty"`   // Rotation in degrees

	// Generic position/dimensions for other shapes (e.g. rect shorthand or text)
	X *float64 `json:"x,omitempty"`
	Y *float64 `json:"y,omitempty"`
	W *float64 `json:"w,omitempty"`
	H *float64 `json:"h,omitempty"`

	// Text specific
	Text     string   `json:"text,omitempty"`
	FontSize *float64 `json:"fontSize,omitempty"`
}

// Asset represents a reusable object definition (e.g. a piece of furniture).
type Asset struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Type           string   `json:"type"` // "room", "furniture", "fixture"
	W              float64  `json:"w"`
	H              float64  `json:"h"`
	Color          string   `json:"color"`
	Entities       []Entity `json:"entities"`
	IsDefaultShape bool     `json:"isDefaultShape,omitempty"`
	Snap           bool     `json:"snap,omitempty"`
	BoundX         *float64 `json:"boundX,omitempty"`
	BoundY         *float64 `json:"boundY,omitempty"`
}

// Instance represents an instance of an Asset placed on the canvas.
type Instance struct {
	ID       string  `json:"id"`
	AssetID  string  `json:"assetId,omitempty"` // Optional for text instances
	Type     string  `json:"type"`              // "text" or asset type
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Rotation float64 `json:"rotation"`
	Locked   bool    `json:"locked"`

	// Text instance specific
	Text     string   `json:"text,omitempty"`
	FontSize *float64 `json:"fontSize,omitempty"`
	Color    string   `json:"color,omitempty"`
}

// ProjectData represents the full data content of a project file.
type ProjectData struct {
	LocalAssets   []Asset           `json:"assets"`
	Instances     []Instance        `json:"instances"`
	DefaultColors map[string]string `json:"defaultColors,omitempty"`
}

// AppSettings represents the application-wide settings.
type AppSettings struct {
	GridSize         float64 `json:"gridSize"`
	SnapInterval     float64 `json:"snapInterval"`
	InitialZoom      float64 `json:"initialZoom"`
	AutoSaveInterval int     `json:"autoSaveInterval"`
}
