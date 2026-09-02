
SHELL = /bin/bash
.SHELLFLAGS = -o pipefail -c

.PHONY: help
help: ## Print info about all commands
	@echo "Helper Commands:"
	@echo
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[01;32m%-20s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "NOTE: dependencies between commands are not automatic. Eg, you must run 'deps' and 'build' first, and after any changes"

.PHONY: build
build: ## Build the website, output in ./build/
	npm run build

.PHONY: test
test: ## Run all tests (run 'make build' first — check-build reads ./build)
	# Scoped to the content dirs. The checker's own ignore list has a bare
	# "node_modules" entry, which globby matches only at the top level — so run
	# from the repo root it descends into server/node_modules and fails on
	# dependencies' READMEs. That made `make test` fail regardless of anything
	# in this repo.
	#
	# Each run also globs ../docs relative to its -c dir (a convenience for
	# website/-style monorepos), so the reported file counts overlap: every
	# invocation below re-checks docs/ as well as its own directory. Harmless,
	# but it is why the numbers do not match the file counts.
	npx docusaurus-mdx-checker -c docs
	npx docusaurus-mdx-checker -c blog
	npx docusaurus-mdx-checker -c src/pages
	npx docusaurus-mdx-checker -c i18n
	node scripts/check-build.mjs

#.PHONY: fmt
#fmt: ## Run syntax re-formatting
#	yarn prettier

#.PHONY: lint
#lint: ## Run style checks and verify syntax
#	yarn verify

.PHONY: nvm-setup
nvm-setup: ## Use NVM to install and activate node+npm (see .node-version)
	nvm install 22
	nvm use 22

.PHONY: deps
deps: ## Installs dependent libs using 'npm install'
	npm install

.PHONY: run-dev
run-dev: ## Run local dev server: http://localhost:3000
	npm start
