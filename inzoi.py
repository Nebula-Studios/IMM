# Misc Modules
import os
import logging
import fnmatch
from pathlib import Path

# PyQt6 Modules
from PyQt6.QtCore import QFileInfo, QDir  # type: ignore

# Mod Organizer 2 Modules
import mobase  # type: ignore
from mobase import IOrganizer, IPlugin  # type: ignore

from ..basic_features import BasicLocalSavegames, BasicModDataChecker, GlobPatterns
from ..basic_features.utils import is_directory
from ..basic_game import BasicGame

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Settings Variables
SymLinkSettingsName = "Deploy Symlinks on Launch"
LogLevel = "Info"


class InzoiModDataChecker(BasicModDataChecker):
    def __init__(self):
        # Directly pass the GlobPatterns to BasicModDataChecker
        super().__init__(
            GlobPatterns(
                unfold=[
                    "AIGenerated",
                    "Creations",
                    "inZOI",
                ],
                valid=[
                    # Validate a mod if the following files are in the root of the mod folder
                    "My3DPrinter",
                    "MyAIMotions",
                    "MySites",
                    "MyAppearances",
                    "BlueClient",
                    "meta.ini",
                ],
                delete=[
                    # Delte useless crap that is included in the root of the mod folder
                    "*.txt",
                    "*.md",
                    "README",
                    "icon.png",
                    "license",
                    "LICENCE",
                    "manifest.json",
                    "*.dll.mdb",
                    "*.pdb",
                ],
                move={
                    # Correct DLLs at root of mod folder
                    "dwmapi.dll": "BlueClient/Binaries/Win64",
                    "dsound.dll": "BlueClient/Binaries/Win64",
                    # Correct PAK, UCAS or UTOC at root of mod folder
                    "*.pak": "BlueClient/Content/Paks/~mods/",
                    "*.utoc": "BlueClient/Content/Paks/~mods/",
                    "*.ucas": "BlueClient/Content/Paks/~mods/",
                },
            )
        )

    # Handles subfolder mod data validation
    def dataLooksValid(
        self, filetree: mobase.IFileTree
    ) -> mobase.ModDataChecker.CheckReturn:
        parent = filetree.parent()
        if parent is not None and self.dataLooksValid(parent) is self.FIXABLE:
            return self.FIXABLE

        # Call the parent class method to get the base check
        check_return = super().dataLooksValid(filetree)

        # Case: AFolder/BlueClient/... (needs flattening)
        if (
            check_return is self.INVALID
            and len(filetree) == 1
            and is_directory(wrapper := filetree[0])
            and any(
                is_directory(entry) and entry.name().lower() == "blueclient"
                for entry in wrapper
            )
        ):
            return self.FIXABLE

        # Case: A folder that only contains a single directory which has pak/utoc/ucas
        if (
            check_return is self.INVALID
            and len(filetree) == 1
            and is_directory(folder := filetree[0])
            and any(
                fnmatch.fnmatch(entry.name(), "*.pak")
                or fnmatch.fnmatch(entry.name(), "*.utoc")
                or fnmatch.fnmatch(entry.name(), "*.ucas")
                for entry in folder
            )
        ):
            return self.FIXABLE

        # Case: Check for 3DPrinter mod folder with *.glb files
        for entry in filetree:
            if is_directory(entry) and entry.name():
                # Look for *.glb files in the directory
                motion_files = [
                    f
                    for f in entry
                    if f.isFile() and fnmatch.fnmatch(f.name(), "*.glb")
                ]
                if motion_files:
                    if LogLevel == "Debug":
                        logger.info(f"Found .glb files in folder: {entry.name()}")
                    return self.FIXABLE

        # Case: Check for AIMotions mod folder with motion.dat files
        for entry in filetree:
            if is_directory(entry) and entry.name():
                # Look for motion.dat files in the directory
                motion_files = [
                    f
                    for f in entry
                    if f.isFile() and fnmatch.fnmatch(f.name(), "motion.dat")
                ]
                if motion_files:
                    if LogLevel == "Debug":
                        logger.info(f"Found motion.dat files in folder: {entry.name()}")
                    return self.FIXABLE

        # Case: Check for MySites mod folder with site.dat files
        for entry in filetree:
            if is_directory(entry) and entry.name():
                # Look for sites.dat files in the directory
                site_files = [
                    f
                    for f in entry
                    if f.isFile() and fnmatch.fnmatch(f.name(), "site.dat")
                ]
                if site_files:
                    if LogLevel == "Debug":
                        logger.info(f"Found site.dat files in folder: {entry.name()}")
                    return self.FIXABLE

        # Case: Check for MyAppearances mod folder with appearance.dat files
        for entry in filetree:
            if is_directory(entry) and entry.name():
                # Look for appearance.dat files in the directory
                site_files = [
                    f
                    for f in entry
                    if f.isFile() and fnmatch.fnmatch(f.name(), "appearance.dat")
                ]
                if site_files:
                    if LogLevel == "Debug":
                        logger.info(
                            f"Found appearance.dat files in folder: {entry.name()}"
                        )
                    return self.FIXABLE

        # Case: Further checks for valid or fixable 3DPrinter/AIMotion/MySites/MyAppearances mod folder structures
        for entry in filetree:
            if is_directory(entry) and entry.name():
                folder_name = entry.name()

                # Case 1: VALID - Properly named parent folders
                if folder_name in (
                    "My3DPrinter",
                    "MyAIMotions",
                    "MySites",
                    "MyAppearances",
                ):
                    for sub_entry in entry:
                        if is_directory(sub_entry):
                            name = sub_entry.name().lower()
                            if len(name) == 32 and all(
                                c in "0123456789abcdef" for c in name
                            ):
                                if LogLevel == "Debug":
                                    logger.info(f"Proper folder: {folder_name}/{name}")
                                return self.VALID

                # Case 2: FIXABLE - Some other folder contains a MD5-named subfolder
                for sub_entry in entry:
                    if is_directory(sub_entry):
                        name = sub_entry.name().lower()
                        if len(name) == 32 and all(
                            c in "0123456789abcdef" for c in name
                        ):
                            if LogLevel == "Debug":
                                logger.info(
                                    f"Found misplaced MD5 folder: {folder_name}/{name}"
                                )
                            return self.FIXABLE

        return check_return

    # Fixes incorrectly packaged mods
    def fix(self, filetree: mobase.IFileTree) -> mobase.IFileTree:
        filetree = super().fix(filetree)

        if LogLevel == "Debug":
            logger.info("🛠️ Fixing mod data...")
        # Step 1: Flatten AFolder/BlueClient/... to just BlueClient/...
        if (
            len(filetree) == 1
            and is_directory(wrapper := filetree[0])
            and any(
                is_directory(entry) and entry.name().lower() == "blueclient"
                for entry in wrapper
            )
        ):
            for entry in wrapper:
                if is_directory(entry) and entry.name().lower() == "blueclient":
                    if LogLevel == "Debug":
                        logger.info(
                            f"Flattening wrapper folder: {wrapper.name()} → {entry.name()}"
                        )
                    filetree.move(entry, entry.name())
                    filetree.remove(wrapper)
                    break

        # Step 1.5: Fix misplaced MD5 folders (e.g. weed plant/<md5>/...)
        for entry in filetree:
            if is_directory(entry) and entry.name():
                outer_folder_name = entry.name()
                fixed_any = False

                for sub_entry in list(entry):  # Use list() since we may mutate
                    if is_directory(sub_entry):
                        original_md5_name = sub_entry.name()
                        lower_name = original_md5_name.lower()
                        if len(lower_name) == 32 and all(
                            c in "0123456789abcdef" for c in lower_name
                        ):
                            logger.info(
                                f"📦 Found misplaced MD5 folder: {outer_folder_name}/{original_md5_name}"
                            )

                            all_inner_files = [f for f in sub_entry if f.isFile()]
                            has_glb = any(
                                f.name().lower().endswith(".glb")
                                for f in all_inner_files
                            )
                            has_motion = any(
                                f.name().lower() == "motion.dat"
                                for f in all_inner_files
                            )
                            has_site = any(
                                f.name().lower() == "site.dat" for f in all_inner_files
                            )
                            has_appearance = any(
                                f.name().lower() == "appearance.dat"
                                for f in all_inner_files
                            )

                            if has_glb:
                                target = Path("My3DPrinter") / original_md5_name
                                logger.info(
                                    f"✈️ Moving folder to proper 🖨️ 3DPrinter location: {target}"
                                )
                                filetree.move(sub_entry, str(target))
                                fixed_any = True

                            elif has_motion:
                                target = Path("MyAIMotions") / original_md5_name
                                logger.info(
                                    f"✈️ Moving folder to proper 🎭 MyAIMotions location: {target}"
                                )
                                filetree.move(sub_entry, str(target))
                                fixed_any = True
                            elif has_site:
                                target = Path("MySites") / original_md5_name
                                logger.info(
                                    f"✈️ Moving folder to proper 🏠 MySites location: {target}"
                                )
                                filetree.move(sub_entry, str(target))
                                fixed_any = True
                            elif has_appearance:
                                target = Path("MyAppearances") / original_md5_name
                                logger.info(
                                    f"✈️ Moving folder to proper 👤 MyAppearances location: {target}"
                                )
                                filetree.move(sub_entry, str(target))
                                fixed_any = True

                if fixed_any and not any(True for _ in entry):  # Remove outer if empty
                    logger.info(
                        f"🧹 Removing empty wrapper folder: {outer_folder_name}"
                    )
                    filetree.remove(entry)

        # Step 2: Handle single-folder case with .pak/.utoc/.ucas
        if (
            self.dataLooksValid(filetree) is self.FIXABLE
            and len(filetree) > 0
            and is_directory(folder := filetree[0])
            and folder is not None
            and len(folder) > 0
        ):
            file_extensions = ["*.pak", "*.utoc", "*.ucas"]
            matched_files: list[str] = []
            files_to_move: list[mobase.IFileTreeEntry] = []

            all_files = [
                entry.name() for entry in folder if entry is not None and entry.isFile()
            ]
            logger.info(
                f"🧐 Checking for PAK,UTOC or UCAS files in folder: {folder.name()}"
            )
            logger.info(f"🗂️ Found files in folder: {', '.join(all_files)}")

            for entry in folder:
                if entry is not None and entry.isFile():
                    file_name = entry.name()

                    if LogLevel == "Debug":
                        logger.info(f"🧐 Checking file: {file_name}")

                    for ext in file_extensions:
                        if fnmatch.fnmatch(file_name, ext):
                            logger.info(f"🗂️ File matches: {file_name} (Matches {ext})")
                            files_to_move.append(entry)
                            matched_files.append(file_name)
                            break

            for file in files_to_move:
                filetree.move(file, "BlueClient/Content/Paks/~mods/")
                if LogLevel == "Debug":
                    logger.info(
                        f"✈️ Moved {file.name()} to BlueClient/Content/Paks/~mods/"
                    )

            if matched_files:
                logger.info(f"✈️ Moved files: {', '.join(matched_files)}")
            else:
                logger.info("👍 No matching files were moved.")

            if not any(entry.isFile() for entry in folder):
                logger.info(f"🧹 Removing empty folder: {folder.name()}")
                filetree.remove(folder)

        # Step 3: Handle 3D printer mod folder logic
        fixable_folders = []  # List to store folders with .glb files

        # First pass to detect folders needing fixes
        for entry in filetree:
            if entry is not None and is_directory(entry) and entry.name():
                all_files = [f for f in entry if f is not None and f.isFile()]

                if all_files:
                    glb_files = [
                        f for f in all_files if f.name().lower().endswith(".glb")
                    ]

                    if glb_files:  # If the folder contains .glb files
                        folder_name = entry.name()
                        logger.info(f"Found .glb files in folder: {folder_name}")
                        fixable_folders.append(entry)  # Collect folder for fixing

        # Process each folder that needs fixing
        for entry in fixable_folders:
            folder_name = entry.name()
            logger.info(
                f"Found incorrectly formatted 🖨️ 3DPrinter mod folder: {folder_name}"
            )

            # If there's only one glb file, make the folder name match the .glb file name
            all_files = [f for f in entry if f is not None and f.isFile()]
            glb_files = [f for f in all_files if f.name().lower().endswith(".glb")]
            if len(glb_files) == 1:
                expected_name = Path(glb_files[0].name()).stem
                if folder_name != expected_name:
                    logger.info(
                        f"Renaming 🖨️ 3DPrinter mod folder: {folder_name} → {expected_name}"
                    )
                    filetree.move(entry, expected_name)
                    folder_name = expected_name

            logger.info(f"🛠️ Fixing 🖨️ 3DPrinter mod folder: {folder_name}")
            target_dir = Path("My3DPrinter") / folder_name
            target_dir.mkdir(parents=True, exist_ok=True)

            # Moving all files in the directory to the target directory
            for file in all_files:
                if file is not None and file.isFile():
                    logger.info(f"✈️ Moving file: {file.name()} to {target_dir}")
                    filetree.move(file, str(target_dir / file.name()))

            # Check if folder is empty after moving files, and remove if so
            if not any(f is not None and f.isFile() for f in entry):
                logger.info(f"🧹Removing empty folder: {folder_name}")
                filetree.remove(entry)

        # Step 4: Handle AIMotion mod folder logic
        fixable_folders = []  # List to store folders with motion.dat files

        for entry in filetree:
            if entry is not None and is_directory(entry) and entry.name():
                all_files = [f for f in entry if f is not None and f.isFile()]

                if all_files:
                    motion_files = [
                        f for f in all_files if f.name().lower() == "motion.dat"
                    ]

                    if motion_files:  # If the folder contains motion.dat files
                        folder_name = entry.name()
                        logger.info(f"Found motion.dat files in folder: {folder_name}")
                        fixable_folders.append(entry)  # Collect folder for fixing

        # Process each folder that needs fixing
        for entry in fixable_folders:
            folder_name = entry.name()
            logger.info(
                f"Found incorrectly formatted 🎭 MyAIMotions mod folder: {folder_name}"
            )

            all_files = [f for f in entry if f is not None and f.isFile()]
            motion_files = [f for f in all_files if f.name().lower() == "motion.dat"]

            logger.info(f"🛠️ Fixing 🎭 MyAIMotions mod folder: {folder_name}")
            target_dir = Path("MyAIMotions") / folder_name
            target_dir.mkdir(parents=True, exist_ok=True)

            # Moving all files in the directory to the target directory
            for file in all_files:
                if file is not None and file.isFile():
                    logger.info(f"✈️ Moving file: {file.name()} to {target_dir}")
                    filetree.move(file, str(target_dir / file.name()))

            # Check if folder is empty after moving files, and remove if so
            if not any(f is not None and f.isFile() for f in entry):
                logger.info(f"🧹 Removing empty folder: {folder_name}")
                filetree.remove(entry)

        # Step 5: Handle MySites mod folder logic
        fixable_folders = []  # List to store folders with motion.dat files

        for entry in filetree:
            if entry is not None and is_directory(entry) and entry.name():
                all_files = [f for f in entry if f is not None and f.isFile()]

                if all_files:
                    motion_files = [
                        f for f in all_files if f.name().lower() == "site.dat"
                    ]

                    if motion_files:  # If the folder contains motion.dat files
                        folder_name = entry.name()
                        logger.info(f"Found site.dat files in folder: {folder_name}")
                        fixable_folders.append(entry)  # Collect folder for fixing

        # Process each folder that needs fixing
        for entry in fixable_folders:
            folder_name = entry.name()
            logger.info(
                f"Found incorrectly formatted 🏠 MySites mod folder: {folder_name}"
            )

            all_files = [f for f in entry if f is not None and f.isFile()]
            motion_files = [f for f in all_files if f.name().lower() == "site.dat"]

            logger.info(f"🛠️ Fixing 🏠 MySites mod folder: {folder_name}")
            target_dir = Path("MySites") / folder_name
            target_dir.mkdir(parents=True, exist_ok=True)

            # Moving all files in the directory to the target directory
            for file in all_files:
                if file is not None and file.isFile():
                    logger.info(f"✈️ Moving file: {file.name()} to {target_dir}")
                    filetree.move(file, str(target_dir / file.name()))

            # Check if folder is empty after moving files, and remove if so
            if not any(f is not None and f.isFile() for f in entry):
                logger.info(f"🧹 Removing empty folder: {folder_name}")
                filetree.remove(entry)

        # Step 6: Handle MyAppearances mod folder logic
        fixable_folders = []  # List to store folders with appearance.dat files

        for entry in filetree:
            if entry is not None and is_directory(entry) and entry.name():
                all_files = [f for f in entry if f is not None and f.isFile()]

                if all_files:
                    appearance_files = [
                        f for f in all_files if f.name().lower() == "appearance.dat"
                    ]

                    if appearance_files:  # If the folder contains motion.dat files
                        folder_name = entry.name()
                        logger.info(
                            f"Found appearance.dat files in folder: {folder_name}"
                        )
                        fixable_folders.append(entry)  # Collect folder for fixing

        # Process each folder that needs fixing
        for entry in fixable_folders:
            folder_name = entry.name()
            logger.info(
                f"Found incorrectly formatted 👤 MyAppearances mod folder: {folder_name}"
            )

            all_files = [f for f in entry if f is not None and f.isFile()]
            motion_files = [f for f in all_files if f.name().lower() == "site.dat"]

            logger.info(f"🛠️ Fixing 👤 MyAppearances mod folder: {folder_name}")
            target_dir = Path("MyAppearances") / folder_name
            target_dir.mkdir(parents=True, exist_ok=True)

            # Moving all files in the directory to the target directory
            for file in all_files:
                if file is not None and file.isFile():
                    logger.info(f"✈️ Moving file: {file.name()} to {target_dir}")
                    filetree.move(file, str(target_dir / file.name()))

            # Check if folder is empty after moving files, and remove if so
            if not any(f is not None and f.isFile() for f in entry):
                logger.info(f"🧹 Removing empty folder: {folder_name}")
                filetree.remove(entry)

        return filetree


class InzoiGame(BasicGame):
    Name = "inZOI Support Plugin"
    Author = "Frog"
    Version = "2.0.0"
    Description = "Adds inZOI support to Mod Organizer 2, includes handling for 3DPrinter Files, Includes handling for UE4SS dwmapi.dll injection."

    GameName = "inZOI"
    GameShortName = "inzoi"
    GameBinary = "inZOI.exe"
    GameNexusId = 7480
    GameSteamId = 2456740

    GameDataPath = "%GAME_PATH%"
    GameDocumentsDirectory = "%DOCUMENTS%/inZOI"
    GameSavesDirectory = "%GAME_DOCUMENTS%/SaveGames"

    def init(self, organizer: IOrganizer) -> bool:
        if not super().init(organizer):
            return False

        self._register_feature(InzoiModDataChecker())
        organizer.onAboutToRun(self._onAboutToRun)
        organizer.onFinishedRun(self._onFinishedRun)
        organizer.onPluginSettingChanged(self._settings_change_callback)
        # Not really doing anything with this right now.
        # self._register_feature(BasicLocalSavegames(self.savesDirectory()))
        self._organizer = organizer
        modList = self._organizer.modList()
        modList.onModStateChanged(self.mod_state_changed)
        return True

    @property
    def deploy_symlinkmods(self) -> bool:
        return self._organizer.pluginSetting(self.name(), SymLinkSettingsName)

    @property
    def loglevel(self) -> bool:
        return self._organizer.pluginSetting(self.name(), "LogLevel").capitalize()

    def executables(self):
        return [
            mobase.ExecutableInfo(
                "inZOI",
                QFileInfo(
                    self.gameDirectory(),
                    self.binaryName(),
                ),
            ),
            # This is probably wrong but ¯\_(ツ)_/¯ it works so fuck it.
            mobase.ExecutableInfo(
                "inZOI Shipping Exe",
                QFileInfo(
                    self.gameDirectory(),
                    "inZOI-Win64-Shipping.exe",
                ),
            ),
        ]

    def executableForcedLoads(self) -> list[mobase.ExecutableForcedLoadSetting]:
        try:
            efls = super().executableForcedLoads()
        except AttributeError:
            efls = []

        libraries = ["BlueClient/Binaries/Win64/dwmapi.dll"]

        # Only apply the forced load settings to "inZOI-Win64-Shipping.exe"
        for exe in self.executables():
            if exe.binary().fileName() == "inZOI-Win64-Shipping.exe":
                efls.extend(
                    mobase.ExecutableForcedLoadSetting(
                        exe.binary().fileName(), lib
                    ).withEnabled(True)
                    for lib in libraries
                )

        return efls

    def mod_state_changed(self, mod_states: dict[str, mobase.ModState]):
        printer_base = (
            Path(self.documentsDirectory().absolutePath())
            / "AIGenerated"
            / "My3DPrinter"
        )
        motions_base = (
            Path(self.documentsDirectory().absolutePath())
            / "AIGenerated"
            / "MyAIMotions"
        )
        site_base = (
            Path(self.documentsDirectory().absolutePath()) / "Creations" / "MySites"
        )
        appearance_base = (
            Path(self.documentsDirectory().absolutePath())
            / "Creations"
            / "MyAppearances"
        )
        printer_base.mkdir(parents=True, exist_ok=True)
        motions_base.mkdir(parents=True, exist_ok=True)
        site_base.mkdir(parents=True, exist_ok=True)
        appearance_base.mkdir(parents=True, exist_ok=True)

        for mod_name, state in mod_states.items():
            mod = self._organizer.modList().getMod(mod_name)
            if not mod:
                logger.warning(f"🧐 Mod not found: {mod_name}")
                continue

            mod_path = Path(mod.absolutePath())
            printer_source_dir = mod_path / "My3DPrinter"
            motions_source_dir = mod_path / "MyAIMotions"
            site_source_dir = mod_path / "MySites"
            appearance_source_dir = mod_path / "MyAppearances"

            if state & mobase.ModState.ACTIVE:
                logger.info(f"✔️ {mod_name} enabled.")

                if self.deploy_symlinkmods:
                    continue  # skip symlink handling and extra logging

                if printer_source_dir.is_dir():
                    logger.info(f"🖨️ {mod_name} is a 3DPrinter mod!")
                    for folder in printer_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = printer_base / folder.name
                            if target_dir.exists():
                                if target_dir.is_symlink():
                                    target_dir.unlink()
                                else:
                                    logger.warning(
                                        f"⚠️ Skipping existing non-symlink: {target_dir}"
                                    )
                                    continue
                            try:
                                os.symlink(folder, target_dir, target_is_directory=True)
                                logger.info(
                                    f"Created 🖨️ 3DPrinter 🔗 symlink: {target_dir} → {folder}"
                                )
                            except Exception as e:
                                logger.error(
                                    f"❌ Failed to create 🖨️ symlink for {mod_name}: {e}"
                                )

                if motions_source_dir.is_dir():
                    logger.info(f"🎭 {mod_name} is a AIMotions mod!")
                    for folder in motions_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = motions_base / folder.name
                            if target_dir.exists():
                                if target_dir.is_symlink():
                                    target_dir.unlink()
                                else:
                                    logger.warning(
                                        f"⚠️ Skipping existing non-symlink: {target_dir}"
                                    )
                                    continue
                            try:
                                os.symlink(folder, target_dir, target_is_directory=True)
                                logger.info(
                                    f"Created 🎭 AIMotions 🔗 symlink: {target_dir} → {folder}"
                                )
                            except Exception as e:
                                logger.error(
                                    f"❌ Failed to create 🎭 symlink for {mod_name}: {e}"
                                )

                if site_source_dir.is_dir():
                    logger.info(f"🎭 {mod_name} is a MySites mod!")
                    for folder in site_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = site_base / folder.name
                            if target_dir.exists():
                                if target_dir.is_symlink():
                                    target_dir.unlink()
                                else:
                                    logger.warning(
                                        f"⚠️ Skipping existing non-symlink: {target_dir}"
                                    )
                                    continue
                            try:
                                os.symlink(folder, target_dir, target_is_directory=True)
                                logger.info(
                                    f"Created 🏠 MySites 🔗 symlink: {target_dir} → {folder}"
                                )
                            except Exception as e:
                                logger.error(
                                    f"❌ Failed to create 🏠 symlink for {mod_name}: {e}"
                                )

                if appearance_source_dir.is_dir():
                    logger.info(f"👤 {mod_name} is a MyAppearances mod!")
                    for folder in appearance_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = appearance_base / folder.name
                            if target_dir.exists():
                                if target_dir.is_symlink():
                                    target_dir.unlink()
                                else:
                                    logger.warning(
                                        f"⚠️ Skipping existing non-symlink: {target_dir}"
                                    )
                                    continue
                            try:
                                os.symlink(folder, target_dir, target_is_directory=True)
                                logger.info(
                                    f"Created 👤 MyAppearances 🔗 symlink: {target_dir} → {folder}"
                                )
                            except Exception as e:
                                logger.error(
                                    f"❌ Failed to create 👤 symlink for {mod_name}: {e}"
                                )

            else:
                logger.info(f"➖ {mod_name} disabled.")

                if self.deploy_symlinkmods:
                    continue  # skip symlink removal and extra logging

                if printer_source_dir.is_dir():
                    logger.info(f"🖨️ {mod_name} is a 3DPrinter mod!")
                    for folder in printer_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = printer_base / folder.name
                            if target_dir.exists() and target_dir.is_symlink():
                                try:
                                    target_dir.unlink()
                                    logger.info(
                                        f"🧹 Removed 🖨️ 3DPrinter 🔗 symlink: {target_dir} for {mod_name}"
                                    )
                                except Exception as e:
                                    logger.error(
                                        f"❌ Failed to remove 🖨️ symlink for {mod_name}: {e}"
                                    )

                if motions_source_dir.is_dir():
                    logger.info(f"🎭 {mod_name} is a AIMotions mod!")
                    for folder in motions_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = motions_base / folder.name
                            if target_dir.exists() and target_dir.is_symlink():
                                try:
                                    target_dir.unlink()
                                    logger.info(
                                        f"🧹 Removed 🎭 AIMotions 🔗 symlink: {target_dir} for {mod_name}"
                                    )
                                except Exception as e:
                                    logger.error(
                                        f"❌ Failed to remove 🎭 symlink for {mod_name}: {e}"
                                    )

                if site_source_dir.is_dir():
                    logger.info(f"🎭 {mod_name} is a AIMotions mod!")
                    for folder in site_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = site_base / folder.name
                            if target_dir.exists() and target_dir.is_symlink():
                                try:
                                    target_dir.unlink()
                                    logger.info(
                                        f"🧹 Removed 🏠 MySites 🔗 symlink: {target_dir} for {mod_name}"
                                    )
                                except Exception as e:
                                    logger.error(
                                        f"❌ Failed to remove 🏠 symlink for {mod_name}: {e}"
                                    )

                if appearance_source_dir.is_dir():
                    logger.info(f"👤 {mod_name} is a MyAppearances mod!")
                    for folder in appearance_source_dir.iterdir():
                        if folder.is_dir():
                            target_dir = appearance_base / folder.name
                            if target_dir.exists() and target_dir.is_symlink():
                                try:
                                    target_dir.unlink()
                                    logger.info(
                                        f"🧹 Removed 👤 MyAppearances 🔗 symlink: {target_dir} for {mod_name}"
                                    )
                                except Exception as e:
                                    logger.error(
                                        f"❌ Failed to remove 👤 symlink for {mod_name}: {e}"
                                    )

    def AddBitfixSymlinksOnLaunch(self):
        mods_parent_path = Path(self._organizer.modsPath())
        modlist = self._organizer.modList().allModsByProfilePriority()

        for mod in modlist:
            if self._organizer.modList().state(mod) & mobase.ModState.ACTIVE:
                mod_path = mods_parent_path / mod
                for file_name in ["bitfix", "dsound.dll"]:
                    file_src = (
                        mod_path / "BlueClient" / "Binaries" / "Win64" / file_name
                    )
                    if file_src.exists():
                        file_dst = (
                            Path(self.gameDirectory().absolutePath())
                            / "BlueClient"
                            / "Binaries"
                            / "Win64"
                            / file_name
                        )
                        if file_dst.exists():
                            logger.info(
                                f"Checking existing 🔗symlink or file: {file_dst}"
                            )
                            # Only remove if it's a symlink
                            if file_dst.is_symlink():
                                logger.info(
                                    f"🧹 Removing existing 🔗symlink: {file_dst}"
                                )
                                file_dst.unlink()
                            else:
                                logger.info(
                                    f"Skipping removal of file or directory: {file_dst}"
                                )
                        try:
                            logger.info(f"Creating 🔗symlink: {file_dst} → {file_src}")
                            os.symlink(file_src, file_dst, target_is_directory=False)
                        except Exception as e:
                            logger.error(
                                f"❌Failed to create 🔗symlink for {file_src}: {e}"
                            )

    def RemoveBitfixSymlinksOnExit(self):
        modlist = self._organizer.modList().allModsByProfilePriority()

        for mod in modlist:
            if self._organizer.modList().state(mod) & mobase.ModState.ACTIVE:
                for file_name in ["bitfix", "dsound.dll"]:
                    file_dst = (
                        Path(self.gameDirectory().absolutePath())
                        / "BlueClient"
                        / "Binaries"
                        / "Win64"
                        / file_name
                    )
                    if file_dst.is_symlink():
                        logger.info(f"🧹 Removing 🔗symlink: {file_dst}")
                        file_dst.unlink()

    def Add3DPrinterSymlinksOnLaunch(self):
        printer_base = (
            Path(self.documentsDirectory().absolutePath())
            / "AIGenerated"
            / "My3DPrinter"
        )
        printer_base.mkdir(parents=True, exist_ok=True)

        modlist = self._organizer.modList().allModsByProfilePriority()
        for mod_name in modlist:
            if self._organizer.modList().state(mod_name) & mobase.ModState.ACTIVE:
                mod = self._organizer.modList().getMod(mod_name)
                if not mod:
                    continue

                mod_path = Path(mod.absolutePath())
                source_dir = mod_path / "My3DPrinter"

                if not source_dir.is_dir():
                    continue

                for actual_mod_folder in source_dir.iterdir():
                    if actual_mod_folder.is_dir():
                        target_dir = printer_base / actual_mod_folder.name
                        if target_dir.exists():
                            if target_dir.is_symlink():
                                target_dir.unlink()
                            else:
                                logger.warning(
                                    f"⚠️ Skipping non-symlink existing path: {target_dir}"
                                )
                                continue
                        try:
                            os.symlink(
                                actual_mod_folder, target_dir, target_is_directory=True
                            )
                            logger.info(
                                f"Created 3DPrinter 🔗symlink: {target_dir} → {actual_mod_folder}"
                            )
                        except Exception as e:
                            logger.error(f"❌ Failed to create 3DPrinter symlink: {e}")

    def Remove3DPrinterSymlinksOnExit(self):
        printer_base = (
            Path(self.documentsDirectory().absolutePath())
            / "AIGenerated"
            / "My3DPrinter"
        )

        if printer_base.exists():
            for child in printer_base.iterdir():
                if child.is_symlink():
                    try:
                        child.unlink()
                        logger.info(f"🧹 Removed 3DPrinter 🔗symlink: {child}")
                    except Exception as e:
                        logger.error(f"❌ Failed to remove 3DPrinter symlink: {e}")

    def AddAIMotionsSymlinksOnLaunch(self):
        motions_base = (
            Path(self.documentsDirectory().absolutePath())
            / "AIGenerated"
            / "MyAIMotions"
        )
        motions_base.mkdir(parents=True, exist_ok=True)

        modlist = self._organizer.modList().allModsByProfilePriority()
        for mod_name in modlist:
            if self._organizer.modList().state(mod_name) & mobase.ModState.ACTIVE:
                mod = self._organizer.modList().getMod(mod_name)
                if not mod:
                    continue

                mod_path = Path(mod.absolutePath())
                source_dir = mod_path / "MyAIMotions"

                if not source_dir.is_dir():
                    continue

                for actual_mod_folder in source_dir.iterdir():
                    if actual_mod_folder.is_dir():
                        target_dir = motions_base / actual_mod_folder.name
                        if target_dir.exists():
                            if target_dir.is_symlink():
                                target_dir.unlink()
                            else:
                                logger.warning(
                                    f"⚠️ Skipping non-symlink existing path: {target_dir}"
                                )
                                continue
                        try:
                            os.symlink(
                                actual_mod_folder, target_dir, target_is_directory=True
                            )
                            logger.info(
                                f"Created AIMotions 🔗symlink: {target_dir} → {actual_mod_folder}"
                            )
                        except Exception as e:
                            logger.error(f"❌ Failed to create AIMotions symlink: {e}")

    def RemoveAIMotionsSymlinksOnExit(self):
        motions_base = (
            Path(self.documentsDirectory().absolutePath())
            / "AIGenerated"
            / "MyAIMotions"
        )

        if motions_base.exists():
            for child in motions_base.iterdir():
                if child.is_symlink():
                    try:
                        child.unlink()
                        logger.info(f"🧹 Removed AIMotions 🔗symlink: {child}")
                    except Exception as e:
                        logger.error(f"❌ Failed to remove AIMotions symlink: {e}")

    def AddMySitesSymlinksOnLaunch(self):
        mysites_base = (
            Path(self.documentsDirectory().absolutePath()) / "Creations" / "MySites"
        )
        mysites_base.mkdir(parents=True, exist_ok=True)

        modlist = self._organizer.modList().allModsByProfilePriority()
        for mod_name in modlist:
            if self._organizer.modList().state(mod_name) & mobase.ModState.ACTIVE:
                mod = self._organizer.modList().getMod(mod_name)
                if not mod:
                    continue

                mod_path = Path(mod.absolutePath())
                source_dir = mod_path / "MySites"

                if not source_dir.is_dir():
                    continue

                for actual_mod_folder in source_dir.iterdir():
                    if actual_mod_folder.is_dir():
                        target_dir = mysites_base / actual_mod_folder.name
                        if target_dir.exists():
                            if target_dir.is_symlink():
                                target_dir.unlink()
                            else:
                                logger.warning(
                                    f"⚠️ Skipping non-symlink existing path: {target_dir}"
                                )
                                continue
                        try:
                            os.symlink(
                                actual_mod_folder, target_dir, target_is_directory=True
                            )
                            logger.info(
                                f"Created AIMotions 🔗symlink: {target_dir} → {actual_mod_folder}"
                            )
                        except Exception as e:
                            logger.error(f"❌ Failed to create AIMotions symlink: {e}")

    def RemoveMySitesSymlinksOnExit(self):
        mysites_base = (
            Path(self.documentsDirectory().absolutePath()) / "Creations" / "MySites"
        )

        if mysites_base.exists():
            for child in mysites_base.iterdir():
                if child.is_symlink():
                    try:
                        child.unlink()
                        logger.info(f"🧹 Removed MySites 🔗symlink: {child}")
                    except Exception as e:
                        logger.error(f"❌ Failed to remove MySites symlink: {e}")

    def AddMyAppearancesSymlinksOnLaunch(self):
        appearance_base = (
            Path(self.documentsDirectory().absolutePath())
            / "Creations"
            / "MyAppearances"
        )
        appearance_base.mkdir(parents=True, exist_ok=True)

        modlist = self._organizer.modList().allModsByProfilePriority()
        for mod_name in modlist:
            if self._organizer.modList().state(mod_name) & mobase.ModState.ACTIVE:
                mod = self._organizer.modList().getMod(mod_name)
                if not mod:
                    continue

                mod_path = Path(mod.absolutePath())
                source_dir = mod_path / "MyAppearances"

                if not source_dir.is_dir():
                    continue

                for actual_mod_folder in source_dir.iterdir():
                    if actual_mod_folder.is_dir():
                        target_dir = appearance_base / actual_mod_folder.name
                        if target_dir.exists():
                            if target_dir.is_symlink():
                                target_dir.unlink()
                            else:
                                logger.warning(
                                    f"⚠️ Skipping non-symlink existing path: {target_dir}"
                                )
                                continue
                        try:
                            os.symlink(
                                actual_mod_folder, target_dir, target_is_directory=True
                            )
                            logger.info(
                                f"Created MyAppearances 🔗symlink: {target_dir} → {actual_mod_folder}"
                            )
                        except Exception as e:
                            logger.error(
                                f"❌ Failed to create MyAppearances symlink: {e}"
                            )

    def RemoveMyAppearancesSymlinksOnExit(self):
        appearance_base = (
            Path(self.documentsDirectory().absolutePath())
            / "Creations"
            / "MyAppearances"
        )

        if appearance_base.exists():
            for child in appearance_base.iterdir():
                if child.is_symlink():
                    try:
                        child.unlink()
                        logger.info(f"🧹 Removed MyAppearances 🔗symlink: {child}")
                    except Exception as e:
                        logger.error(f"❌ Failed to remove MyAppearances symlink: {e}")

    def _onAboutToRun(self, path: str):
        logger.info(f"🐸 Application about to run: {path}")
        self.AddBitfixSymlinksOnLaunch()
        if self.deploy_symlinkmods:
            self.Add3DPrinterSymlinksOnLaunch()
            self.AddAIMotionsSymlinksOnLaunch()
            self.AddMySitesSymlinksOnLaunch()
            self.AddMyAppearancesSymlinksOnLaunch()
        return True

    def _onFinishedRun(self, path: str, exit_code: int):
        logger.info(f"🐸 Application finished running: {path}, exit code: {exit_code}")
        self.RemoveBitfixSymlinksOnExit()
        if self.deploy_symlinkmods:
            self.Remove3DPrinterSymlinksOnExit()
            self.RemoveAIMotionsSymlinksOnExit()
            self.RemoveMySitesSymlinksOnExit()
            self.RemoveMyAppearancesSymlinksOnExit()
        return True

    def settings(self) -> list[mobase.PluginSetting]:
        return [
            mobase.PluginSetting(
                SymLinkSettingsName,
                (
                    "Deploys 3DPrinter, MyAIMotion, MySites and MyAppearances mods on launch instead of when the mod is enabled."
                ),
                default_value=True,
            ),
            mobase.PluginSetting(
                "LogLevel",
                "Controls the level of detail in the plugin log. Options: Info, Debug",
                default_value="Info",
            ),
        ]

    def _settings_change_callback(
        self,
        plugin_name: str,
        setting: str,
        old: mobase.MoVariant,
        new: mobase.MoVariant,
    ):
        if plugin_name == self.name():
            global LogLevel
            LogLevel = self.loglevel
            if LogLevel == "Debug":
                logger.info(
                    f"🐸 Plugin setting changed: {setting} = {new}, old value: {old}"
                )


def createPlugin() -> IPlugin:
    return InzoiGame()
