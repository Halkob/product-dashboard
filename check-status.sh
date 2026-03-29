#!/bin/bash
# Project Status Check Script
# Run this to verify REQ-001 implementation

echo "🔍 Product Dashboard - REQ-001 Status Check"
echo "=========================================="
echo ""

cd "$(dirname "$0")" || exit 1

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
total=0
found=0

# Function to check file
check_file() {
  local file=$1
  local description=$2
  
  total=$((total + 1))
  
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $description"
    echo "   📄 $file"
    found=$((found + 1))
  else
    echo -e "${RED}❌${NC} $description"
    echo "   📄 $file (MISSING)"
  fi
}

# Function to check directory
check_dir() {
  local dir=$1
  local description=$2
  
  total=$((total + 1))
  
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅${NC} $description"
    echo "   📁 $dir"
    found=$((found + 1))
  else
    echo -e "${RED}❌${NC} $description"
    echo "   📁 $dir (MISSING)"
  fi
}

echo "📦 Backend Infrastructure"
echo "------------------------"
check_file "src/server/index.ts" "Express entry point"
check_file "src/server/app.ts" "Express app setup"
check_file "src/server/routes/health.ts" "Health check endpoint"
check_file "src/server/middleware/errorHandler.ts" "Error handler"
echo ""

echo "📁 Project Structure"
echo "--------------------"
check_dir "src/server/config" "Server config directory"
check_dir "src/server/routes" "Routes directory"
check_dir "src/server/middleware" "Middleware directory"
check_dir "src/server/__tests__" "Backend tests"
check_dir "src/client/components" "Client components"
check_dir "src/client/pages" "Client pages"
check_dir "src/client/store" "Redux store"
check_dir "prisma" "Prisma directory"
check_dir ".github/workflows" "GitHub Actions"
check_dir "docs" "Documentation"
echo ""

echo "🗄️  Database"
echo "------------"
check_file "prisma/schema.prisma" "Prisma schema (5 tables)"
check_file "prisma/seed.ts" "Database seed script"
echo ""

echo "⚙️  Configuration"
echo "----------------"
check_file "package.json" "npm dependencies"
check_file "tsconfig.json" "TypeScript config"
check_file "tsconfig.server.json" "Server TypeScript config"
check_file "tsconfig.client.json" "Client TypeScript config"
check_file "jest.config.js" "Jest configuration"
check_file ".env.example" "Environment template"
check_file ".gitignore" "Git ignore rules"
echo ""

echo "🧪 Testing & CI/CD"
echo "------------------"
check_file "src/server/__tests__/health.test.ts" "Health check tests"
check_file ".github/workflows/test.yml" "Test pipeline"
check_file ".github/workflows/build.yml" "Build pipeline"
echo ""

echo "🐳 Deployment"
echo "-------------"
check_file "Dockerfile" "Docker image"
check_file "docker-compose.yml" "Docker Compose"
echo ""

echo "📚 Documentation"
echo "---------------"
check_file "README.md" "Project README"
check_file "docs/SETUP.md" "Setup guide"
check_file "docs/ARCHITECTURE.md" "Architecture docs"
check_file "docs/SCHEMA.md" "Database schema"
check_file "docs/API.md" "API reference"
check_file "CONTRIBUTING.md" "Contributing guide"
check_file "IMPLEMENTATION_SUMMARY.md" "Implementation summary"
echo ""

echo "=========================================="
echo -e "Summary: ${GREEN}$found / $total${NC} items present"
echo ""

if [ $found -eq $total ]; then
  echo -e "${GREEN}✅ REQ-001 Implementation Complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. npm install       # Install dependencies"
  echo "2. cp .env.example .env  # Setup environment"
  echo "3. npm run dev       # Start development"
  echo ""
  exit 0
else
  echo -e "${YELLOW}⚠️  Some files are missing${NC}"
  exit 1
fi
