# ---- Build stage ----
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install git in case any go modules need it during download
RUN apk add --no-cache git

# Cache dependency downloads separately from source changes
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# ---- Run stage ----
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /server /app/server

EXPOSE 8080

CMD ["/app/server"]