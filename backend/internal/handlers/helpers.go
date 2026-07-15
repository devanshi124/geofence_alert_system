package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func writeJSON(
	w http.ResponseWriter,
	status int,
	data any,
) {

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	w.WriteHeader(status)

	_ = json.NewEncoder(w).
		Encode(data)
}

func formatInt64(
	value int64,
) string {

	return strconv.FormatInt(
		value,
		10,
	)
}
