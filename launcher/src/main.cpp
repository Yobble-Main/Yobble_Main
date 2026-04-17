#include <windows.h>

#include <filesystem>
#include <iostream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

static const wchar_t* kDesktopFolderName = L"desktop";

std::wstring quote(const std::wstring& value) {
  if (value.find_first_of(L" \t\"") == std::wstring::npos) {
    return value;
  }
  std::wstring result = L"\"";
  for (wchar_t ch : value) {
    if (ch == L'\"') {
      result += L'\\';
    }
    result += ch;
  }
  result += L"\"";
  return result;
}

bool pathExists(const fs::path& path) {
  std::error_code ec;
  return fs::exists(path, ec);
}

bool ensureDirectory(const fs::path& path) {
  std::error_code ec;
  fs::create_directories(path, ec);
  return !ec;
}

fs::path getExeDirectory() {
  std::vector<wchar_t> buffer(MAX_PATH);
  DWORD len = 0;
  for (;;) {
    len = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (len == 0) {
      return {};
    }
    if (len < buffer.size() - 1) {
      break;
    }
    buffer.resize(buffer.size() * 2);
  }
  return fs::path(std::wstring(buffer.data(), len)).parent_path();
}

bool runCommand(
  const std::wstring& workingDir,
  const std::wstring& command,
  DWORD* exitCode = nullptr,
  bool waitForExit = true,
  bool hideWindow = true
) {
  std::wstring commandLine = L"cmd.exe /c " + command;

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  if (hideWindow) {
    startup.dwFlags = STARTF_USESHOWWINDOW;
    startup.wShowWindow = SW_HIDE;
  }

  PROCESS_INFORMATION processInfo{};
  DWORD creationFlags = hideWindow ? CREATE_NO_WINDOW : 0;

  std::vector<wchar_t> mutableCommand(commandLine.begin(), commandLine.end());
  mutableCommand.push_back(L'\0');

  std::vector<wchar_t> mutableDir;
  LPCWSTR workingDirPtr = nullptr;
  if (!workingDir.empty()) {
    mutableDir.assign(workingDir.begin(), workingDir.end());
    mutableDir.push_back(L'\0');
    workingDirPtr = mutableDir.data();
  }

  BOOL created = CreateProcessW(
    nullptr,
    mutableCommand.data(),
    nullptr,
    nullptr,
    FALSE,
    creationFlags,
    nullptr,
    workingDirPtr,
    &startup,
    &processInfo
  );

  if (!created) {
    return false;
  }

  if (waitForExit) {
    WaitForSingleObject(processInfo.hProcess, INFINITE);
    DWORD code = 0;
    GetExitCodeProcess(processInfo.hProcess, &code);
    if (exitCode) {
      *exitCode = code;
    }
    CloseHandle(processInfo.hThread);
    CloseHandle(processInfo.hProcess);
    return code == 0;
  }

  if (exitCode) {
    *exitCode = 0;
  }
  CloseHandle(processInfo.hThread);
  CloseHandle(processInfo.hProcess);
  return true;
}

bool installDependencies(const fs::path& desktopRoot) {
  if (!pathExists(desktopRoot / "package.json")) {
    return false;
  }

  DWORD exitCode = 0;
  std::wcout << L"Updating Electron desktop dependencies...\n";
  if (!runCommand(desktopRoot.wstring(), L"npm install --no-fund --no-audit", &exitCode, true) || exitCode != 0) {
    return false;
  }

  return true;
}

bool launchDetached(const fs::path& workingDir, const std::wstring& command) {
  std::wstring detachedCommand = L"start \"\" /b " + command;
  return runCommand(workingDir.wstring(), detachedCommand, nullptr, false, true);
}

int main() {
  std::wcout << L"=== Yobble Launcher ===\n";

  const fs::path exeDir = getExeDirectory();
  if (exeDir.empty()) {
    std::wcerr << L"Could not resolve launcher directory.\n";
    return 1;
  }

  const fs::path desktopRoot = exeDir / kDesktopFolderName;
  if (!ensureDirectory(desktopRoot)) {
    std::wcerr << L"Could not create or access desktop folder.\n";
    return 1;
  }

  if (!installDependencies(desktopRoot)) {
    std::wcerr << L"Electron dependency update failed.\n";
    return 1;
  }

  std::wcout << L"Starting Electron shell...\n";
  if (!launchDetached(desktopRoot, L"npm start")) {
    std::wcerr << L"Could not start the Electron shell.\n";
    return 1;
  }

  std::wcout << L"Launcher finished.\n";
  return 0;
}
