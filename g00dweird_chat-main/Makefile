.PHONY: launch-check backend-test frontend-test frontend-build quick

launch-check:
	./scripts/launch_check.sh

backend-test:
	cd backend && python3 -m pytest tests/test_launch_config.py tests/test_admin.py tests/test_basketball.py tests/test_world_contracts.py tests/test_animation_registry.py

frontend-test:
	cd frontend && CI=true npm test -- --watchAll=false src/lib/api.test.js src/lib/admin.test.js src/lib/worldIcons.test.js src/lib/halloweenGhosts.test.js src/lib/halloweenLightning.test.js src/components/IsoWorld.test.js src/components/AnimSpriteAssets.test.js src/components/AnimSprite.test.js src/components/SpritePicker.test.jsx

frontend-build:
	cd frontend && npm run build

quick: launch-check backend-test frontend-test frontend-build
