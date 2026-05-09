.PHONY: all build build-dev typecheck lint format format-check test check package clean watch

all: build

build:
	pnpm run build

build-dev:
	pnpm run dev:build

typecheck:
	pnpm run typecheck

lint:
	pnpm run lint

format:
	pnpm run format

format-check:
	pnpm run format:check

test:
	pnpm run test

check:
	pnpm run check

package:
	pnpm run package

clean:
	rm -rf dist dist-dev releases

watch:
	pnpm run test:watch
