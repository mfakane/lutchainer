from __future__ import annotations

import os

import bpy
from bpy.props import BoolProperty, StringProperty
from bpy.types import AddonPreferences, Operator, Panel
from bpy_extras.io_utils import ImportHelper

from .manifest import load_lutchain_file
from .node_builder import import_lutchain_material

MODULE_NAME = __package__ or "lutchainer_blender_addon"

bl_info = {
    "name": "LUT Chainer Importer",
    "author": "LUT Chainer",
    "version": (0, 2, 0),
    "blender": (4, 0, 0),
    "location": "File > Import",
    "description": "Import .lutchain files into Blender shader nodes",
    "category": "Import-Export",
}
__addon_enabled__ = False


def get_addon_preferences(context: bpy.types.Context | None = None) -> "LUTCHAINER_AP_preferences | None":
    ctx = context or bpy.context
    preferences = getattr(ctx, "preferences", None)
    if preferences is None:
        return None
    addon = preferences.addons.get(MODULE_NAME)
    if addon is None:
        return None
    prefs = addon.preferences
    if isinstance(prefs, LUTCHAINER_AP_preferences):
        return prefs
    return None


def run_import_from_path(
    context: bpy.types.Context,
    filepath: str,
    use_helper_wiring: bool,
) -> bpy.types.Material:
    import_data = load_lutchain_file(filepath)
    material = import_lutchain_material(
        context=context,
        import_data=import_data,
        filepath=filepath,
        use_helper_wiring=use_helper_wiring,
    )
    preferences = get_addon_preferences(context)
    if preferences is not None:
        preferences.last_fixture_path = filepath
        preferences.use_helper_wiring_default = use_helper_wiring
    return material


class LUTCHAINER_AP_preferences(AddonPreferences):
    bl_idname = MODULE_NAME

    last_fixture_path: StringProperty(
        name="Last Fixture Path",
        description="Last imported .lutchain path used by Reload And Reimport",
        subtype="FILE_PATH",
        default="",
    )
    use_helper_wiring_default: BoolProperty(
        name="Use Eevee Helper Wiring By Default",
        description="Default helper wiring option for import and reload-and-reimport",
        default=True,
    )

    def draw(self, _context: bpy.types.Context) -> None:
        layout = self.layout
        layout.prop(self, "last_fixture_path")
        layout.prop(self, "use_helper_wiring_default")
        row = layout.row(align=True)
        row.operator("lutchainer.reload_script", icon="FILE_REFRESH")
        row.operator("lutchainer.reload_and_reimport", icon="IMPORT")


class LUTCHAINER_OT_import_lutchain(Operator, ImportHelper):
    bl_idname = "lutchainer.import_lutchain"
    bl_label = "Import LUT Chain"
    bl_description = "Import a .lutchain file into a new Blender material"
    bl_options = {"REGISTER", "UNDO"}

    filename_ext = ".lutchain"
    filter_glob: StringProperty(
        default="*.lutchain",
        options={"HIDDEN"},
    )
    use_helper_wiring: BoolProperty(
        name="Use Eevee Helper Wiring",
        description=(
            "Create helper nodes for Facing/Fresnel and approximate Lightness/Specular "
            "using Eevee-friendly Shader to RGB wiring"
        ),
        default=True,
    )

    def invoke(self, context: bpy.types.Context, event: bpy.types.Event) -> set[str]:
        preferences = get_addon_preferences(context)
        if preferences is not None:
            self.use_helper_wiring = preferences.use_helper_wiring_default
            if preferences.last_fixture_path:
                self.filepath = preferences.last_fixture_path
        return ImportHelper.invoke(self, context, event)

    def execute(self, context: bpy.types.Context) -> set[str]:
        try:
            material = run_import_from_path(
                context=context,
                filepath=self.filepath,
                use_helper_wiring=self.use_helper_wiring,
            )
        except Exception as exc:  # pragma: no cover - Blender runtime path
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}

        self.report(
            {"INFO"},
            f"Imported {os.path.basename(self.filepath)} into material '{material.name}'",
        )
        return {"FINISHED"}


class LUTCHAINER_OT_reload_script(Operator):
    bl_idname = "lutchainer.reload_script"
    bl_label = "Reload Script"
    bl_description = "Reload the add-on implementation modules from disk"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context: bpy.types.Context) -> set[str]:
        preferences = get_addon_preferences(context)
        if preferences is None:
            self.report({"ERROR"}, "Add-on preferences are not available")
            return {"CANCELLED"}

        try:
            from .dev_reload import reload_addon

            reload_addon(module_name=MODULE_NAME)
        except Exception as exc:  # pragma: no cover - Blender runtime path
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}

        self.report({"INFO"}, "LUT Chainer implementation modules reloaded")
        return {"FINISHED"}


class LUTCHAINER_OT_reload_and_reimport(Operator):
    bl_idname = "lutchainer.reload_and_reimport"
    bl_label = "Reload And Reimport"
    bl_description = "Reload the add-on and reimport Last Fixture Path"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context: bpy.types.Context) -> set[str]:
        preferences = get_addon_preferences(context)
        if preferences is None:
            self.report({"ERROR"}, "Add-on preferences are not available")
            return {"CANCELLED"}
        last_fixture_path = str(preferences.last_fixture_path)
        if not last_fixture_path:
            self.report({"ERROR"}, "Last Fixture Path is not set")
            return {"CANCELLED"}

        try:
            from .dev_reload import reload_and_reimport_from_preferences

            material = reload_and_reimport_from_preferences(
                context=context,
                module_name=MODULE_NAME,
            )
        except Exception as exc:  # pragma: no cover - Blender runtime path
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}

        self.report(
            {"INFO"},
            f"Reloaded add-on and reimported '{os.path.basename(last_fixture_path)}' into '{material.name}'",
        )
        return {"FINISHED"}


class LUTCHAINER_PT_import_panel(Panel):
    bl_idname = "LUTCHAINER_PT_import_panel"
    bl_label = "LUT Chainer"
    bl_space_type = "NODE_EDITOR"
    bl_region_type = "UI"
    bl_category = "LUT Chainer"

    @classmethod
    def poll(cls, context: bpy.types.Context) -> bool:
        space_data = getattr(context, "space_data", None)
        return bool(space_data and getattr(space_data, "tree_type", "") == "ShaderNodeTree")

    def draw(self, context: bpy.types.Context) -> None:
        layout = self.layout
        preferences = get_addon_preferences(context)

        layout.label(text="Import .lutchain into shader nodes")
        operator = layout.operator(LUTCHAINER_OT_import_lutchain.bl_idname, icon="IMPORT")
        operator.use_helper_wiring = (
            preferences.use_helper_wiring_default if preferences is not None else True
        )

        layout.separator()
        layout.label(text="Development Reload")
        if preferences is not None:
            if preferences.last_fixture_path:
                layout.label(text=os.path.basename(preferences.last_fixture_path))
            row = layout.row(align=True)
            row.operator(LUTCHAINER_OT_reload_script.bl_idname, icon="FILE_REFRESH")
            row.operator(LUTCHAINER_OT_reload_and_reimport.bl_idname, icon="IMPORT")
        else:
            layout.label(text="Preferences unavailable", icon="ERROR")


def _menu_import(self: bpy.types.Menu, _context: bpy.types.Context) -> None:
    self.layout.operator(LUTCHAINER_OT_import_lutchain.bl_idname, text="LUT Chainer (.lutchain)")


CLASSES = (
    LUTCHAINER_AP_preferences,
    LUTCHAINER_OT_import_lutchain,
    LUTCHAINER_OT_reload_script,
    LUTCHAINER_OT_reload_and_reimport,
    LUTCHAINER_PT_import_panel,
)


def register() -> None:
    global __addon_enabled__
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.TOPBAR_MT_file_import.append(_menu_import)
    __addon_enabled__ = True


def unregister() -> None:
    global __addon_enabled__
    try:
        bpy.types.TOPBAR_MT_file_import.remove(_menu_import)
    except (AttributeError, RuntimeError):
        pass
    for cls in reversed(CLASSES):
        try:
            bpy.utils.unregister_class(cls)
        except RuntimeError:
            pass
    __addon_enabled__ = False
