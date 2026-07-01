
init:
	@echo "Initializing project..."
	@git pull origin main
	@npm install
	@npm audit fix
	@echo "Project initialized successfully."

push:
	@echo "Pushing changes to repository..."
	@git add .
	@read -p "Enter commit message: " msg; \
	git commit -m "$$msg"
	@git push
	@echo "Changes pushed successfully."

