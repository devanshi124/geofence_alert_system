import {
  Calendar,
  Eye,
  Pencil,
  Trash2,
  MapPinned,
} from "lucide-react";

import MiniGeofenceMap from "./MiniGeofenceMap";

function formatDate(date) {
  return new Date(
    date,
  ).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

function GeofenceCard({
  geofence,
}) {
  return (
    <article className="geofence-card">

      <MiniGeofenceMap
        coordinates={
          geofence.coordinates
        }
      />

      <div className="geofence-card-body">

        <div className="geofence-card-header">

          <div>

            <h3>
              {geofence.name}
            </h3>

            <p>
              {
                geofence.description
              }
            </p>

          </div>

          <span className="status-badge active">
            Active
          </span>

        </div>

        <div className="geofence-meta">

          <span className="category-pill">

            <MapPinned size={15} />

            {geofence.category.replace(
              "_",
              " ",
            )}

          </span>

          <span>

            <Calendar size={14} />

            {formatDate(
              geofence.created_at,
            )}

          </span>

        </div>

        <div className="geofence-actions">

          <button>

            <Eye size={17} />

          </button>

          <button>

            <Pencil size={17} />

          </button>

          <button className="danger">

            <Trash2 size={17} />

          </button>

        </div>

      </div>

    </article>
  );
}

export default GeofenceCard;