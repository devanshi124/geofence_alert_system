import { useEffect, useMemo, useState } from "react";

import {
  CheckCircle2,
  ChevronLeft,
  Eraser,
  LayoutGrid,
  List as ListIcon,
  LoaderCircle,
  MapPinned,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Upload,
  Users,
} from "lucide-react";

import {
  createGeofence,
  getGeofences,
} from "../api/geofenceApi";

import GeofenceEditorMap from "../components/GeofenceEditorMap";
import GeofenceThumbnailMap from "../components/GeofenceThumbnailMap";

const INITIAL_FORM = {
  name: "",
  description: "",
  category: "",
};



function GeofencesPage() {
  const [geofences, setGeofences] = useState([]);
  const [draftPoints, setDraftPoints] = useState([]);

  const [form, setForm] = useState(INITIAL_FORM);

  const [drawingEnabled, setDrawingEnabled] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [geofenceQuery, setGeofenceQuery] =
    useState("");

  const [viewMode, setViewMode] = useState("grid");

  const [locationQuery, setLocationQuery] =
  useState("");

const [searchResults, setSearchResults] =
  useState([]);

const [searchedLocation, setSearchedLocation] =
  useState(null);

const [searchingLocation, setSearchingLocation] =
  useState(false);

  useEffect(() => {
  const query = locationQuery.trim();

  if (query.length < 3) {
    setSearchResults([]);
    return;
  }

  const controller = new AbortController();

  const timer = setTimeout(async () => {
    try {
      setSearchingLocation(true);

      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "5",
        addressdetails: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const data = await response.json();

      setSearchResults(data);
    } catch (searchError) {
      if (searchError.name !== "AbortError") {
        console.error(searchError);
      }
    } finally {
      setSearchingLocation(false);
    }
  }, 500);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [locationQuery]);

  useEffect(() => {
    async function loadGeofences() {
      try {
        setLoading(true);

        const response = await getGeofences();

        setGeofences(response.geofences ?? []);
      } catch (requestError) {
        console.error(requestError);

        setError("Could not load geofences.");
      } finally {
        setLoading(false);
      }
    }

    loadGeofences();
  }, []);

  const filteredGeofences = useMemo(() => {
    const query = geofenceQuery.trim().toLowerCase();

    if (!query) {
      return geofences;
    }

    return geofences.filter((geofence) => {
      const haystack = [
        geofence.name,
        geofence.description,
        geofence.category,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [geofences, geofenceQuery]);

  function focusGeofence(geofence) {
    const coordinates = geofence.coordinates ?? [];

    if (coordinates.length === 0) {
      return;
    }

    const latitudes = coordinates.map(
      ([, latitude]) => latitude,
    );

    const longitudes = coordinates.map(
      ([longitude]) => longitude,
    );

    setSearchedLocation({
      latitude:
        (Math.min(...latitudes) +
          Math.max(...latitudes)) /
        2,
      longitude:
        (Math.min(...longitudes) +
          Math.max(...longitudes)) /
        2,
      name: geofence.name,
    });

    document
      .querySelector(".geofence-map-card")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  const canSubmit = useMemo(() => {
    return (
      form.name.trim() !== "" &&
      form.description.trim() !== "" &&
      form.category.trim() !== "" &&
      draftPoints.length >= 3 &&
      !submitting
    );
  }, [form, draftPoints, submitting]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function addPoint(point) {
    setDraftPoints((current) => [
      ...current,
      point,
    ]);

    setSuccess("");
  }

  function undoPoint() {
    setDraftPoints((current) =>
      current.slice(0, -1),
    );
  }

  function clearDrawing() {
    setDraftPoints([]);
  }

  function resetCreator() {
    setForm(INITIAL_FORM);
    setDraftPoints([]);
    setDrawingEnabled(false);
    setError("");
    setSuccess("");
  }

  

  async function handleSubmit(event) {
  event.preventDefault();

  if (!canSubmit) {
    setError(
      "Enter all fields and draw at least three polygon points.",
    );
    return;
  }

  try {
    setSubmitting(true);
    setError("");
    setSuccess("");

    /*
     * Leaflet/draftPoints:
     * [latitude, longitude]
     *
     * API GeoJSON-style contract:
     * [longitude, latitude]
     */

    const coordinates = draftPoints.map(
      ([latitude, longitude]) => [
        longitude,
        latitude,
      ],
    );

    /*
     * Close polygon.
     */

    const firstPoint = coordinates[0];

    const lastPoint =
      coordinates[coordinates.length - 1];

    if (
      firstPoint[0] !== lastPoint[0] ||
      firstPoint[1] !== lastPoint[1]
    ) {
      coordinates.push([...firstPoint]);
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      coordinates,
      category: form.category.trim(),
    };

    console.log(
      "GEOFENCE PAYLOAD:",
      payload,
    );

    await createGeofence(payload);

    const response = await getGeofences();

    setGeofences(response.geofences ?? []);

    setForm(INITIAL_FORM);
    setDraftPoints([]);
    setDrawingEnabled(false);

    setSuccess(
      "Geofence created successfully.",
    );
  } catch (requestError) {
    console.error(requestError);

    setError(
      requestError.response?.data?.error ??
        "Could not create geofence.",
    );
  } finally {
    setSubmitting(false);
  }
}

  if (loading) {
    return (
      <div className="dashboard-state">
        Loading geofences...
      </div>
    );
  }

  return (
    <div className="page geofences-page">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">
            Spatial Management
          </p>

          <h2>Geofences</h2>

          <p className="page-description">
            Draw monitored areas directly on the
            map and create geofences.
          </p>
        </div>

        <button
          type="button"
          className={
            drawingEnabled
              ? "primary-action active"
              : "primary-action"
          }
          onClick={() =>
            setDrawingEnabled((current) => !current)
          }
        >
          {drawingEnabled ? (
            <MousePointer2 size={16} />
          ) : (
            <Plus size={16} />
          )}

          {drawingEnabled
            ? "Drawing Enabled"
            : "Create Geofence"}
        </button>
      </header>

      <section className="geofence-workspace">
        <article className="geofence-map-card">
          <div className="map-toolbar">
            <div>
              <p className="card-eyebrow">
                Interactive Editor
              </p>

              <h3>Geofence Map</h3>
            </div>

            <div className="map-toolbar-meta">
              <span>
                <MapPinned size={14} />
                {geofences.length} existing zones
              </span>

              <span>
                <MousePointer2 size={14} />
                {draftPoints.length} draft points
              </span>
            </div>
          </div>

          <div className="geofence-map-wrapper">
  <div className="map-location-search">
    <Search size={17} />

    <input
      value={locationQuery}
      onChange={(event) =>
        setLocationQuery(event.target.value)
      }
      placeholder="Search city, address, or location..."
    />

    {searchingLocation && (
      <LoaderCircle
        size={16}
        className="search-spinner"
      />
    )}

    {searchResults.length > 0 && (
      <div className="location-search-results">
        {searchResults.map((result) => (
          <button
            type="button"
            key={result.place_id}
            onClick={() => {
              setSearchedLocation({
                latitude: Number(result.lat),
                longitude: Number(result.lon),
                name: result.display_name,
              });

              setLocationQuery(result.display_name);

              setSearchResults([]);
            }}
          >
            <MapPinned size={15} />

            <span>{result.display_name}</span>
          </button>
        ))}
      </div>
    )}
  </div>

  <GeofenceEditorMap
    geofences={geofences}
    draftPoints={draftPoints}
    drawingEnabled={drawingEnabled}
    onAddPoint={addPoint}
    searchedLocation={searchedLocation}
  />
</div>

          <div className="editor-map-footer">
            {drawingEnabled ? (
              <span>
                Click the map to add polygon points.
                Minimum 3 points required.
              </span>
            ) : (
              <span>
                Click Create Geofence to start drawing.
              </span>
            )}
          </div>
        </article>

        <aside className="geofence-creator-card">
          <div className="side-card-heading">
            <div>
              <p className="card-eyebrow">
                Zone Configuration
              </p>

              <h3>Create Geofence</h3>
            </div>

            <MapPinned size={18} />
          </div>

          <form
            className="geofence-form"
            onSubmit={handleSubmit}
          >
            <label className="form-field">
              <span>Name</span>

              <input
                name="name"
                value={form.name}
                onChange={updateForm}
                placeholder="Warehouse Zone"
              />
            </label>

            <label className="form-field">
              <span>Description</span>

              <textarea
                name="description"
                value={form.description}
                onChange={updateForm}
                rows={3}
                placeholder="Describe the monitored area"
              />
            </label>

            <label className="form-field">
              <span>Category</span>

              <input
                name="category"
                value={form.category}
                onChange={updateForm}
                placeholder="delivery_zone"
              />
            </label>

            <div className="draft-section">
              <div className="draft-section-heading">
                <span>Polygon Points</span>

                <strong>
                  {draftPoints.length}
                </strong>
              </div>

              <div className="draft-point-list">
                {draftPoints.length === 0 ? (
                  <div className="draft-empty">
                    No points selected yet.
                  </div>
                ) : (
                  draftPoints.map(
                    ([latitude, longitude], index) => (
                      <div
                        className="draft-point-row"
                        key={`${latitude}-${longitude}-${index}`}
                      >
                        <span>{index + 1}</span>

                        <div>
                          <strong>
                            {latitude.toFixed(6)}
                          </strong>

                          <small>
                            {longitude.toFixed(6)}
                          </small>
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>

            {error && (
              <div className="form-message error">
                {error}
              </div>
            )}

            {success && (
              <div className="form-message success">
                <CheckCircle2 size={15} />
                {success}
              </div>
            )}

            <div className="drawing-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={draftPoints.length === 0}
                onClick={undoPoint}
              >
                <ChevronLeft size={15} />
                Undo
              </button>

              <button
                type="button"
                className="secondary-action"
                disabled={draftPoints.length === 0}
                onClick={clearDrawing}
              >
                <Eraser size={15} />
                Clear
              </button>

              <button
                type="button"
                className="secondary-action"
                onClick={resetCreator}
              >
                <RotateCcw size={15} />
                Reset
              </button>
            </div>

            <button
              type="submit"
              className="create-geofence-button"
              disabled={!canSubmit}
            >
              <Save size={16} />

              {submitting
                ? "Creating..."
                : "Create Geofence"}
            </button>
          </form>
        </aside>
      </section>

      <section className="existing-geofences-section">
        <div className="geofence-list-toolbar">
          <div className="section-heading-text">
            <p className="card-eyebrow">
              Monitored Areas
            </p>

            <h3>Geofences ({geofences.length})</h3>
          </div>

          <div className="geofence-list-controls">
            <div className="geofence-search-field">
              <Search size={15} />

              <input
                value={geofenceQuery}
                onChange={(event) =>
                  setGeofenceQuery(event.target.value)
                }
                placeholder="Search Geofences"
              />
            </div>

            <div className="geofence-view-toggle">
              <button
                type="button"
                className={
                  viewMode === "list" ? "active" : ""
                }
                title="List view"
                onClick={() => setViewMode("list")}
              >
                <ListIcon size={16} />
              </button>

              <button
                type="button"
                className={
                  viewMode === "grid" ? "active" : ""
                }
                title="Grid view"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <button
              type="button"
              className="secondary-action"
              disabled
              title="Bulk import isn't connected to the backend yet"
            >
              <Upload size={14} />
              Bulk create geofence
            </button>

            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setDrawingEnabled(true);

                document
                  .querySelector(".geofence-map-card")
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
              }}
            >
              <Plus size={16} />
              Create geofence
            </button>
          </div>
        </div>

        {filteredGeofences.length === 0 ? (
          <div className="empty-state">
            {geofenceQuery
              ? "No geofences match your search."
              : "No geofences created yet."}
          </div>
        ) : viewMode === "grid" ? (
          <div className="geofence-thumb-grid">
            {filteredGeofences.map((geofence, index) => (
              <article
                className="geofence-thumb-card"
                key={geofence.id}
              >
                <div className="geofence-thumb-wrapper">
                  <GeofenceThumbnailMap
                    geofence={geofence}
                    colorIndex={index}
                  />
                </div>

                <div className="geofence-thumb-body">
                  <strong>{geofence.name}</strong>

                  <div className="geofence-thumb-stats">
                    <span>
                      <MapPinned size={12} />0 assets
                    </span>

                    <span>
                      <Users size={12} />0 people
                    </span>
                  </div>

                  <button
                    type="button"
                    className="geofence-manage-button"
                    onClick={() =>
                      focusGeofence(geofence)
                    }
                  >
                    Manage
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="geofence-list-rows">
            {filteredGeofences.map((geofence) => (
              <div
                className="geofence-list-row"
                key={geofence.id}
              >
                <div className="geofence-summary-icon">
                  <MapPinned size={18} />
                </div>

                <div className="geofence-list-row-main">
                  <strong>{geofence.name}</strong>
                  <p>{geofence.description}</p>
                </div>

                {geofence.category && (
                  <span className="geofence-thumb-category">
                    {geofence.category}
                  </span>
                )}

                <div className="geofence-list-row-stats">
                  <span>0 assets</span>
                  <span>0 people</span>
                </div>

                <button
                  type="button"
                  className="geofence-manage-button"
                  onClick={() => focusGeofence(geofence)}
                >
                  Manage
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default GeofencesPage;