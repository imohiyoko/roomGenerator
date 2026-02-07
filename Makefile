.PHONY: build run test clean tidy

BINARY_NAME=roomGenerator.exe

build:
	go build -o $(BINARY_NAME) main.go

run:
	go run main.go

test:
	go test ./...

tidy:
	go mod tidy

clean:
	rm -f $(BINARY_NAME)
	rm -f app.log
