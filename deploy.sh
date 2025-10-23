#!/bin/bash

# Deployment script for JunkYard API
echo "🚀 Preparing JunkYard API for deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Add all files
echo "📁 Adding files to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy JunkYard API to Railway"

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Creating GitHub repository..."
    gh repo create junkyard-api --public --source=. --remote=origin
fi

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push -u origin main

echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Go to https://railway.app"
echo "2. New Project → Deploy from GitHub repo"
echo "3. Select 'junkyard-api'"
echo "4. Add environment variable: SERVICE_API_KEY = your-secret-key"
echo "5. Test your deployed API!"
