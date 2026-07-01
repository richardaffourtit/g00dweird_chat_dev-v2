.PHONY: launch-check backend-test frontend-test frontend-build quick

launch-check:
	./scripts/launch_check.sh

backend-test:
	cd backend && python3 -m pytest tests/test_launch_config.py tests/test_admin.py tests/test_basketball.py

frontend-test:
	cd frontend && CI=true npm test -- --watchAll=false src/lib/api.test.js src/lib/admin.test.js src/components/IsoWorld.test.js src/components/AnimSpriteAssets.test.js

frontend-build:
	cd frontend && npm run build

quick: launch-check backend-test frontend-test frontend-build
