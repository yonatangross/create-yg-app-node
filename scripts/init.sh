#!/bin/bash

# =============================================================================
# Project Initialization Script
# Renames the project from "yg-app" to your custom name
# =============================================================================

set -e

CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

# Default values
OLD_NAME="yg-app"
OLD_CONTAINER_PREFIX="yg-app-node"

echo -e "${CYAN}🚀 YG App Node Project Initializer${RESET}"
echo ""

# Get project name
if [ -z "$1" ]; then
    read -p "Enter your project name (e.g., my-awesome-app): " PROJECT_NAME
else
    PROJECT_NAME="$1"
fi

# Validate project name
if [ -z "$PROJECT_NAME" ]; then
    echo -e "${RED}Error: Project name cannot be empty${RESET}"
    exit 1
fi

# Convert to lowercase and replace spaces with hyphens
PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
CONTAINER_PREFIX=$(echo "$PROJECT_NAME" | tr '-' '_')

echo ""
echo -e "${YELLOW}This will rename the project:${RESET}"
echo -e "  Package scope: @${OLD_NAME} → @${PROJECT_NAME}"
echo -e "  Docker containers: ${OLD_CONTAINER_PREFIX} → ${PROJECT_NAME}"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cancelled.${RESET}"
    exit 0
fi

echo ""
echo -e "${CYAN}Renaming project...${RESET}"

# Files to update
FILES=(
    "package.json"
    "packages/shared/package.json"
    "packages/backend/package.json"
    "packages/frontend/package.json"
    "docker-compose.yml"
    "README.md"
)

# Update package.json files
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        # Replace @yg-app with @project-name
        sed -i '' "s/@${OLD_NAME}/@${PROJECT_NAME}/g" "$file" 2>/dev/null || \
        sed -i "s/@${OLD_NAME}/@${PROJECT_NAME}/g" "$file"

        # Replace container names
        sed -i '' "s/${OLD_CONTAINER_PREFIX}/${PROJECT_NAME}/g" "$file" 2>/dev/null || \
        sed -i "s/${OLD_CONTAINER_PREFIX}/${PROJECT_NAME}/g" "$file"

        echo -e "  ${GREEN}✓${RESET} Updated $file"
    fi
done

# Update root package.json name
sed -i '' "s/\"name\": \"create-yg-app-node\"/\"name\": \"${PROJECT_NAME}\"/g" package.json 2>/dev/null || \
sed -i "s/\"name\": \"create-yg-app-node\"/\"name\": \"${PROJECT_NAME}\"/g" package.json

# Update database name in .env.example and docker-compose
if [ -f ".env.example" ]; then
    sed -i '' "s/yg_app_node/${CONTAINER_PREFIX}/g" .env.example 2>/dev/null || \
    sed -i "s/yg_app_node/${CONTAINER_PREFIX}/g" .env.example
    echo -e "  ${GREEN}✓${RESET} Updated .env.example"
fi

# Copy .env.example to .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "  ${GREEN}✓${RESET} Created .env file"
fi

echo ""
echo -e "${GREEN}✓ Project renamed successfully!${RESET}"
echo ""
echo -e "Next steps:"
echo -e "  1. ${CYAN}pnpm install${RESET}        - Install dependencies"
echo -e "  2. ${CYAN}make docker-up${RESET}      - Start Docker services"
echo -e "  3. ${CYAN}make dev${RESET}            - Start development servers"
echo ""
echo -e "Your app will be available at:"
echo -e "  Frontend: ${CYAN}http://localhost:4173${RESET}"
echo -e "  Backend:  ${CYAN}http://localhost:4000${RESET}"
echo -e "  Langfuse: ${CYAN}http://localhost:3001${RESET}"
