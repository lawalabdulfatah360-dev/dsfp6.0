"""
Helper script to push the 'main' branch to GitHub without requiring git.exe on PATH.
Uses Dulwich (pure-Python Git client) and prompts for your GitHub Personal Access Token.
"""

import getpass
import sys
from dulwich import porcelain

REMOTE_URL = "https://github.com/lawalabdulfatah360-dev/dsfp6.0.git"
USERNAME = "lawalabdulfatah360-dev"

def main():
    print("=" * 65)
    print(f" Pushing to: {REMOTE_URL} (branch: main)")
    print("=" * 65)
    token = getpass.getpass("Enter your GitHub Personal Access Token (PAT): ").strip()
    if not token:
        print("Error: No token provided.")
        sys.exit(1)

    auth_url = f"https://{USERNAME}:{token}@github.com/{USERNAME}/dsfp6.0.git"
    print("Uploading commits to GitHub...")
    try:
        porcelain.push(".", auth_url, [b"refs/heads/main"])
        print("\n✅ Successfully pushed to https://github.com/lawalabdulfatah360-dev/dsfp6.0 !")
        print("🌐 Public GitHub Pages URL (once enabled in repo Settings -> Pages):")
        print("   https://lawalabdulfatah360-dev.github.io/dsfp6.0/")
    except Exception as e:
        print(f"\n❌ Push failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
