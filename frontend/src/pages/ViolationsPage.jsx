import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CalendarDays,
  CarFront,
  ChevronDown,
  ChevronUp,
  Clock3,
  Filter,
  LocateFixed,
  MapPinned,
  Search,
  ShieldAlert,
} from "lucide-react";

import {
  getViolations,
} from "../api/violationApi";

import {
  getVehicles,
} from "../api/vehicleApi";

import {
  getGeofences,
} from "../api/geofenceApi";


const INITIAL_FILTERS = {
  vehicle_id: "",
  geofence_id: "",
  start_date: "",
  end_date: "",
  limit: 50,
};


function formatTimestamp(value) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
}


function formatCoordinate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  return number.toFixed(6);
}


function getEventLabel(eventType) {
  switch (eventType) {
    case "entry":
      return "Entry";

    case "exit":
      return "Exit";

    default:
      return eventType;
  }
}


function ViolationsPage() {
  /*
  |--------------------------------------------------------------------------
  | PAGE DATA
  |--------------------------------------------------------------------------
  */

  const [
    violations,
    setViolations,
  ] = useState([]);

  const [
    totalCount,
    setTotalCount,
  ] = useState(0);

  const [
    vehicles,
    setVehicles,
  ] = useState([]);

  const [
    geofences,
    setGeofences,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    filtering,
    setFiltering,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  /*
  |--------------------------------------------------------------------------
  | FILTERS
  |--------------------------------------------------------------------------
  */

  const [
    filters,
    setFilters,
  ] = useState(INITIAL_FILTERS);

  const [
    search,
    setSearch,
  ] = useState("");


  /*
  |--------------------------------------------------------------------------
  | EXPANDED ROW
  |--------------------------------------------------------------------------
  */

  const [
    expandedViolationID,
    setExpandedViolationID,
  ] = useState(null);


  /*
  |--------------------------------------------------------------------------
  | API LOADING
  |--------------------------------------------------------------------------
  */

  async function loadViolations(
    requestedFilters = {},
  ) {
    const response =
      await getViolations(
        requestedFilters,
      );

    setViolations(
      response.violations ?? [],
    );

    setTotalCount(
      response.total_count ?? 0,
    );
  }


  useEffect(() => {
    let ignore = false;

    async function loadPage() {
      try {
        setLoading(true);

        setError("");

        const [
          violationResponse,
          vehicleResponse,
          geofenceResponse,
        ] = await Promise.all([
          getViolations({
            limit:
              INITIAL_FILTERS.limit,
          }),

          getVehicles(),

          getGeofences(),
        ]);

        if (ignore) {
          return;
        }

        setViolations(
          violationResponse.violations ??
            [],
        );

        setTotalCount(
          violationResponse.total_count ??
            0,
        );

        setVehicles(
          vehicleResponse.vehicles ?? [],
        );

        setGeofences(
          geofenceResponse.geofences ??
            [],
        );
      } catch (requestError) {
        console.error(requestError);

        if (!ignore) {
          setError(
            requestError.response
              ?.data?.error ??
              "Could not load violation history.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      ignore = true;
    };
  }, []);


  /*
  |--------------------------------------------------------------------------
  | DERIVED DATA
  |--------------------------------------------------------------------------
  */

  const visibleViolations =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return violations;
      }

      return violations.filter(
        (violation) => {
          const vehicleNumber =
            violation.vehicle_number
              ?.toLowerCase() ?? "";

          const geofenceName =
            violation.geofence_name
              ?.toLowerCase() ?? "";

          const eventType =
            violation.event_type
              ?.toLowerCase() ?? "";

          const violationID =
            violation.id
              ?.toLowerCase() ?? "";

          return (
            vehicleNumber.includes(query) ||
            geofenceName.includes(query) ||
            eventType.includes(query) ||
            violationID.includes(query)
          );
        },
      );
    }, [
      violations,
      search,
    ]);


  const entryCount =
    useMemo(() => {
      return violations.filter(
        (violation) =>
          violation.event_type ===
          "entry",
      ).length;
    }, [violations]);


  const exitCount =
    useMemo(() => {
      return violations.filter(
        (violation) =>
          violation.event_type ===
          "exit",
      ).length;
    }, [violations]);


  const distributionTotal =
    entryCount + exitCount;


  const entryPercentage =
    distributionTotal > 0
      ? Math.round(
          (
            entryCount /
            distributionTotal
          ) * 100,
        )
      : 0;


  const exitPercentage =
    distributionTotal > 0
      ? 100 - entryPercentage
      : 0;


  /*
  |--------------------------------------------------------------------------
  | FILTER FUNCTIONS
  |--------------------------------------------------------------------------
  */

  function updateFilter(event) {
    const {
      name,
      value,
    } = event.target;

    setFilters((current) => ({
      ...current,

      [name]: value,
    }));

    setError("");
  }


  async function applyFilters() {
    if (
      filters.start_date &&
      filters.end_date &&
      filters.start_date >
        filters.end_date
    ) {
      setError(
        "Start date cannot be after end date.",
      );

      return;
    }

    try {
      setFiltering(true);

      setError("");

      setExpandedViolationID(null);

      await loadViolations({
        vehicle_id:
          filters.vehicle_id,

        geofence_id:
          filters.geofence_id,

        start_date:
          filters.start_date,

        end_date:
          filters.end_date,

        limit:
          Number(filters.limit),
      });
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.response
          ?.data?.error ??
          "Could not filter violation history.",
      );
    } finally {
      setFiltering(false);
    }
  }


  async function clearFilters() {
    try {
      setFiltering(true);

      setError("");

      setSearch("");

      setExpandedViolationID(null);

      setFilters(
        INITIAL_FILTERS,
      );

      await loadViolations({
        limit:
          INITIAL_FILTERS.limit,
      });
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Could not reload violation history.",
      );
    } finally {
      setFiltering(false);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | PAGE STATES
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="dashboard-state">
        Loading violation history...
      </div>
    );
  }


  /*
  |--------------------------------------------------------------------------
  | PAGE UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="page violations-page">

      {/* HEADER */}

      <header className="page-header">

        <div>

         
          <h2>
            Violations History
          </h2>

          {/* <p className="page-description">
            Inspect vehicle entry and exit
            transitions recorded by the
            geofencing engine.
          </p> */}

        </div>


        {/* <div className="page-status">

          <ShieldAlert size={15} />

          {totalCount} Total Violations

        </div> */}

      </header>


      {/* ERROR */}

      {error && (

        <div className="form-message error violations-error">

          {error}

        </div>

      )}


      {/* HISTORY CARD */}

      <section className="violations-content-card">


        {/* CARD HEADER */}

        <div className="violations-toolbar">

          <div>

            
            <h3>
              Recorded Violations
            </h3>

          </div>


          <span className="violations-result-count">

            {visibleViolations.length}

            {" "}

            shown

          </span>

        </div>


        {/* FILTERS */}

        <div className="violations-filter-section">


          {/* SEARCH */}

          <label className="violations-search">

            <Search size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search vehicle, geofence, event..."
            />

          </label>


          {/* FILTER GRID */}

          <div className="violations-filter-grid">


            {/* VEHICLE */}

            <label className="violation-filter-field">

              <span>
                Vehicle
              </span>

              <select
                name="vehicle_id"
                value={
                  filters.vehicle_id
                }
                onChange={updateFilter}
              >

                <option value="">
                  All vehicles
                </option>

                {vehicles.map(
                  (vehicle) => (

                    <option
                      key={vehicle.id}
                      value={vehicle.id}
                    >

                      {
                        vehicle.vehicle_number
                      }

                    </option>

                  ),
                )}

              </select>

            </label>


            {/* GEOFENCE */}

            <label className="violation-filter-field">

              <span>
                Geofence
              </span>

              <select
                name="geofence_id"
                value={
                  filters.geofence_id
                }
                onChange={updateFilter}
              >

                <option value="">
                  All geofences
                </option>

                {geofences.map(
                  (geofence) => (

                    <option
                      key={geofence.id}
                      value={geofence.id}
                    >

                      {geofence.name}

                    </option>

                  ),
                )}

              </select>

            </label>


            {/* START DATE */}

            <label className="violation-filter-field">

              <span>
                Start Date
              </span>

              <div className="violation-date-input">

                <CalendarDays size={15} />

                <input
                  type="date"
                  name="start_date"
                  value={
                    filters.start_date
                  }
                  onChange={updateFilter}
                />

              </div>

            </label>


            {/* END DATE */}

            <label className="violation-filter-field">

              <span>
                End Date
              </span>

              <div className="violation-date-input">

                <CalendarDays size={15} />

                <input
                  type="date"
                  name="end_date"
                  value={
                    filters.end_date
                  }
                  onChange={updateFilter}
                />

              </div>

            </label>


            {/* LIMIT */}

            <label className="violation-filter-field">

              <span>
                Limit
              </span>

              <select
                name="limit"
                value={
                  filters.limit
                }
                onChange={updateFilter}
              >

                <option value="25">
                  25
                </option>

                <option value="50">
                  50
                </option>

                <option value="100">
                  100
                </option>

                <option value="250">
                  250
                </option>

                <option value="500">
                  500
                </option>

              </select>

            </label>

          </div>


          {/* FILTER ACTIONS */}

          <div className="violations-filter-actions">

            <button
              type="button"
              className="violations-clear-button"
              onClick={clearFilters}
              disabled={filtering}
            >

              Clear Filters

            </button>


            <button
              type="button"
              className="violations-apply-button"
              onClick={applyFilters}
              disabled={filtering}
            >

              <Filter size={15} />

              {filtering
                ? "Applying..."
                : "Apply Filters"}

            </button>

          </div>

        </div>


        {/* EMPTY STATE */}

        {visibleViolations.length === 0 ? (

          <div className="violations-empty-state">

            <ShieldAlert size={32} />

            <strong>
              No violations found
            </strong>

            <p>
              Change the filters or generate
              vehicle entry and exit transitions.
            </p>

          </div>

        ) : (

          /* TABLE */

          <div className="violations-table-wrapper">

            <table className="violations-table">

              <thead>

                <tr>

                  <th>
                    Vehicle
                  </th>

                  <th>
                    Geofence
                  </th>

                  <th>
                    Event
                  </th>

                  <th>
                    Location
                  </th>

                  <th>
                    Timestamp
                  </th>

                  <th>
                    Details
                  </th>

                </tr>

              </thead>


              <tbody>

                {visibleViolations.map(
                  (violation) => {

                    const expanded =
                      expandedViolationID ===
                      violation.id;

                    return (

                      <ViolationRows
                        key={violation.id}
                        violation={violation}
                        expanded={expanded}
                        onToggle={() =>
                          setExpandedViolationID(
                            expanded
                              ? null
                              : violation.id,
                          )
                        }
                      />

                    );
                  },
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* =====================================================
          VIOLATION ANALYTICS
      ===================================================== */}

      <section className="violation-analytics">


        {/* SUMMARY PANEL */}

        <article className="violation-summary-panel">


          <div className="violation-analytics-heading">

            <p className="card-eyebrow">
              Violation Summary
            </p>

            <h3>
              Transition Overview
            </h3>

            <p>
              Summary of entry and exit events
              returned by the current violation
              query.
            </p>

          </div>


          <div className="violation-summary-content">

            <span className="violation-total-icon">

              <ShieldAlert size={25} />

            </span>


            <div>

              <strong className="violation-total-value">

                {distributionTotal}

              </strong>


              <span className="violation-total-label">

                Total Violations

              </span>

            </div>

          </div>


          <div className="violation-summary-breakdown">


            <div>

              <span className="summary-dot entry" />

              <span>
                Entry Events
              </span>

              <strong>
                {entryCount}
              </strong>

            </div>


            <div>

              <span className="summary-dot exit" />

              <span>
                Exit Events
              </span>

              <strong>
                {exitCount}
              </strong>

            </div>


          </div>

        </article>


        {/* EVENT DISTRIBUTION PANEL */}

        <article className="violation-distribution-panel">


          <div className="violation-analytics-heading">

            <p className="card-eyebrow">
              Event Distribution
            </p>

            <h3>
              Entry vs Exit Events
            </h3>

            <p>
              Distribution of geofence transition
              events returned by the current
              violation query.
            </p>

          </div>


          <div className="distribution-content">


            {/* PIE CHART */}

            <div className="violation-pie-wrapper">

              <div
                className="violation-pie-chart"
                style={{
                  "--entry-angle":
                    `${entryPercentage * 3.6}deg`,
                }}
              >

                <div className="pie-chart-center">

                  <strong>
                    {distributionTotal}
                  </strong>

                  <span>
                    Events
                  </span>

                </div>

              </div>

            </div>


            {/* DISTRIBUTION DETAILS */}

            <div className="distribution-legend">


              {/* ENTRY */}

              <div className="distribution-row">

                <div className="distribution-label">

                  <span className="summary-dot entry" />

                  <div>

                    <strong>
                      Entry
                    </strong>

                    <span>
                      Entered geofence
                    </span>

                  </div>

                </div>


                <div className="distribution-value">

                  <strong>
                    {entryCount}
                  </strong>

                  <span>
                    {entryPercentage}%
                  </span>

                </div>

              </div>


              {/* EXIT */}

              <div className="distribution-row">

                <div className="distribution-label">

                  <span className="summary-dot exit" />

                  <div>

                    <strong>
                      Exit
                    </strong>

                    <span>
                      Exited geofence
                    </span>

                  </div>

                </div>


                <div className="distribution-value">

                  <strong>
                    {exitCount}
                  </strong>

                  <span>
                    {exitPercentage}%
                  </span>

                </div>

              </div>


              {/* INSIGHT */}

              <div className="distribution-insight">

                <AlertTriangle size={16} />

                <span>

                  {distributionTotal === 0
                    ? "No transition events are available for analysis."
                    : entryCount === exitCount
                      ? "Entry and exit transitions are evenly distributed."
                      : entryCount > exitCount
                        ? "Entry transitions are currently more frequent."
                        : "Exit transitions are currently more frequent."}

                </span>

              </div>


            </div>

          </div>

        </article>

      </section>

    </div>
  );
}


function ViolationRows({
  violation,
  expanded,
  onToggle,
}) {
  return (
    <>


      {/* MAIN ROW */}

      <tr>


        {/* VEHICLE */}

        <td>

          <div className="violation-primary-cell">

            <span className="violation-cell-icon vehicle">

              <CarFront size={16} />

            </span>


            <div>

              <strong>

                {violation.vehicle_number}

              </strong>


              <small>

                {violation.vehicle_id}

              </small>

            </div>

          </div>

        </td>


        {/* GEOFENCE */}

        <td>

          <div className="violation-primary-cell">

            <span className="violation-cell-icon geofence">

              <MapPinned size={16} />

            </span>


            <div>

              <strong>

                {violation.geofence_name}

              </strong>


              <small>

                {violation.geofence_id}

              </small>

            </div>

          </div>

        </td>


        {/* EVENT */}

        <td>

          <span
            className={`violation-event-badge ${violation.event_type}`}
          >

            {getEventLabel(
              violation.event_type,
            )}

          </span>

        </td>


        {/* LOCATION */}

        <td>

          <div className="violation-coordinate">

            <LocateFixed size={14} />

            <span>

              {formatCoordinate(
                violation.latitude,
              )}

              ,

              {" "}

              {formatCoordinate(
                violation.longitude,
              )}

            </span>

          </div>

        </td>


        {/* TIMESTAMP */}

        <td>

          <div className="violation-time">

            <Clock3 size={14} />

            {formatTimestamp(
              violation.timestamp,
            )}

          </div>

        </td>


        {/* DETAILS */}

        <td>

          <button
            type="button"
            className="violation-expand-button"
            onClick={onToggle}
            aria-label={
              expanded
                ? "Hide violation details"
                : "Show violation details"
            }
          >

            {expanded
              ? (
                <ChevronUp size={16} />
              )
              : (
                <ChevronDown size={16} />
              )}

          </button>

        </td>

      </tr>


      {/* EXPANDED DETAILS */}

      {expanded && (

        <tr className="violation-expanded-row">

          <td colSpan="6">

            <div className="violation-expanded-content">


              <div>

                <span>
                  Violation ID
                </span>

                <strong>
                  {violation.id}
                </strong>

              </div>


              <div>

                <span>
                  Vehicle ID
                </span>

                <strong>
                  {violation.vehicle_id}
                </strong>

              </div>


              <div>

                <span>
                  Geofence ID
                </span>

                <strong>
                  {violation.geofence_id}
                </strong>

              </div>


              <div>

                <span>
                  Event Type
                </span>

                <strong>

                  {getEventLabel(
                    violation.event_type,
                  )}

                </strong>

              </div>


              <div>

                <span>
                  Latitude
                </span>

                <strong>

                  {formatCoordinate(
                    violation.latitude,
                  )}

                </strong>

              </div>


              <div>

                <span>
                  Longitude
                </span>

                <strong>

                  {formatCoordinate(
                    violation.longitude,
                  )}

                </strong>

              </div>


              <div>

                <span>
                  Timestamp
                </span>

                <strong>

                  {formatTimestamp(
                    violation.timestamp,
                  )}

                </strong>

              </div>


            </div>

          </td>

        </tr>

      )}

    </>
  );
}


export default ViolationsPage;