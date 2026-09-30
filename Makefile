.PHONY: infra-up infra-down infra-reset

infra-up:
	bash scripts/infra.sh up $(ARGS)

infra-down:
	bash scripts/infra.sh down $(ARGS)

infra-reset:
	bash scripts/infra.sh reset $(ARGS)
