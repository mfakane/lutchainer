from __future__ import annotations

import importlib
import os
import sys

import bpy


def _capture_preferences(module_name: str) -> dict[str, object]:
    addon = bpy.context.preferences.addons.get(module_name)
    if addon is None:
        return {}
    prefs = addon.preferences
    return {
        "last_fixture_path": getattr(prefs, "last_fixture_path", ""),
        "use_helper_wiring_default": getattr(prefs, "use_helper_wiring_default", True),
    }


def _restore_preferences(module_name: str, values: dict[str, object]) -> None:
    addon = bpy.context.preferences.addons.get(module_name)
    if addon is None:
        return
    prefs = addon.preferences
    for key, value in values.items():
        if hasattr(prefs, key):
            setattr(prefs, key, value)


def _module_parent_from_runtime(module_name: str) -> str:
    module = importlib.import_module(module_name)
    module_file = getattr(module, "__file__", "")
    if not module_file:
        raise ValueError("Cannot resolve add-on source path from runtime module")
    package_dir = os.path.dirname(os.path.abspath(module_file))
    return os.path.dirname(package_dir)


def _reload_submodules(module_name: str) -> None:
    submodule_names = sorted(
        (
            name for name in sys.modules
            if name.startswith(f"{module_name}.")
            and name != __name__
        ),
        key=lambda name: name.count("."),
    )
    for name in submodule_names:
        module = sys.modules.get(name)
        if module is not None:
            importlib.reload(module)


def reload_addon(module_name: str):
    addon_parent = _module_parent_from_runtime(module_name)
    if addon_parent not in sys.path:
        sys.path.insert(0, addon_parent)

    importlib.invalidate_caches()
    saved_preferences = _capture_preferences(module_name)
    root_module = importlib.import_module(module_name)
    _reload_submodules(module_name)
    _restore_preferences(module_name, saved_preferences)
    return root_module


def reload_and_reimport_from_preferences(context: bpy.types.Context, module_name: str):
    addon = context.preferences.addons.get(module_name)
    if addon is None:
        raise ValueError("Add-on preferences are not available")

    prefs = addon.preferences
    last_fixture_path = str(getattr(prefs, "last_fixture_path", ""))
    use_helper_wiring = bool(getattr(prefs, "use_helper_wiring_default", True))
    if not last_fixture_path:
        raise ValueError("Last Fixture Path is not set")

    new_module = reload_addon(module_name)
    return new_module.run_import_from_path(
        context=context,
        filepath=last_fixture_path,
        use_helper_wiring=use_helper_wiring,
    )
