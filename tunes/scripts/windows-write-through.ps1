param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('inspect', 'replace')]
  [string]$Operation,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$NativeArguments
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class MusicFixtureNativeAuthority {
    private const uint GENERIC_READ = 0x80000000;
    private const uint GENERIC_WRITE = 0x40000000;
    private const uint DELETE = 0x00010000;
    private const uint FILE_READ_ATTRIBUTES = 0x00000080;
    private const uint FILE_TRAVERSE = 0x00000020;
    private const uint SYNCHRONIZE = 0x00100000;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint FILE_SHARE_DELETE = 0x00000004;
    private const uint OPEN_EXISTING = 3;
    private const uint CREATE_NEW = 1;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const uint FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
    private const uint FILE_FLAG_WRITE_THROUGH = 0x80000000;
    private const uint FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
    private const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x00000400;
    private const uint MOVEFILE_WRITE_THROUGH = 0x00000008;
    private const int FileRenameInfo = 3;
    private const int FileDispositionInfo = 4;
    private const long MAX_AUTHORITY_BYTES = 131072;

    [StructLayout(LayoutKind.Sequential)]
    private struct FILETIME {
        public uint Low;
        public uint High;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BY_HANDLE_FILE_INFORMATION {
        public uint FileAttributes;
        public FILETIME CreationTime;
        public FILETIME LastAccessTime;
        public FILETIME LastWriteTime;
        public uint VolumeSerialNumber;
        public uint FileSizeHigh;
        public uint FileSizeLow;
        public uint NumberOfLinks;
        public uint FileIndexHigh;
        public uint FileIndexLow;
    }

    private sealed class Identity {
        public uint VolumeSerial;
        public ulong FileId;
        public uint Attributes;
        public uint LinkCount;
        public long Size;
        public string Sha256 = "-";

        public string Json() {
            return "{\"volumeSerial\":\"" + VolumeSerial.ToString("x8")
                + "\",\"fileId\":\"" + FileId.ToString("x16")
                + "\",\"attributes\":" + Attributes.ToString()
                + ",\"linkCount\":" + LinkCount.ToString()
                + ",\"size\":" + Size.ToString()
                + ",\"sha256\":\"" + Sha256 + "\"}";
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(
        SafeFileHandle file,
        out BY_HANDLE_FILE_INFORMATION information);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ReadFile(
        SafeFileHandle file,
        byte[] buffer,
        uint bytesToRead,
        out uint bytesRead,
        IntPtr overlapped);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetFilePointerEx(
        SafeFileHandle file,
        long distance,
        out long newPosition,
        uint moveMethod);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetFileInformationByHandle(
        SafeFileHandle file,
        int informationClass,
        IntPtr information,
        uint bufferSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool FlushFileBuffers(SafeFileHandle file);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(
        SafeFileHandle file,
        StringBuilder path,
        uint pathLength,
        uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveFileExW(string source, string destination, uint flags);

    private static Exception NativeFailure(string operation) {
        int code = Marshal.GetLastWin32Error();
        return new Win32Exception(code, operation + " failed with native code " + code.ToString() + ".");
    }

    private static SafeFileHandle Open(string path, uint access, uint share, bool directory, uint creation = OPEN_EXISTING, uint extraFlags = 0) {
        uint flags = FILE_FLAG_OPEN_REPARSE_POINT | extraFlags | (directory ? FILE_FLAG_BACKUP_SEMANTICS : 0);
        SafeFileHandle handle = CreateFileW(path, access, share, IntPtr.Zero, creation, flags, IntPtr.Zero);
        if (handle.IsInvalid) throw NativeFailure("authority open");
        return handle;
    }

    private static Identity InspectHandle(SafeFileHandle handle, bool requireRegular, bool hashContent) {
        BY_HANDLE_FILE_INFORMATION info;
        if (!GetFileInformationByHandle(handle, out info)) throw NativeFailure("authority inspect");
        bool directory = (info.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
        bool reparse = (info.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
        if (requireRegular && (directory || reparse || info.NumberOfLinks != 1)) {
            throw new InvalidOperationException("Authority identity is not a single-link regular file.");
        }
        ulong sizeUnsigned = ((ulong)info.FileSizeHigh << 32) | info.FileSizeLow;
        if (sizeUnsigned > long.MaxValue) throw new InvalidOperationException("Authority size is invalid.");
        Identity identity = new Identity {
            VolumeSerial = info.VolumeSerialNumber,
            FileId = ((ulong)info.FileIndexHigh << 32) | info.FileIndexLow,
            Attributes = info.FileAttributes,
            LinkCount = info.NumberOfLinks,
            Size = (long)sizeUnsigned,
        };
        if (hashContent) identity.Sha256 = HashHandle(handle, identity.Size);
        return identity;
    }

    private static string HashHandle(SafeFileHandle handle, long size) {
        if (size < 0 || size > MAX_AUTHORITY_BYTES) throw new InvalidOperationException("Authority size is outside the bounded contract.");
        long ignored;
        if (!SetFilePointerEx(handle, 0, out ignored, 0)) throw NativeFailure("authority seek");
        byte[] bytes = new byte[(int)size];
        int offset = 0;
        while (offset < bytes.Length) {
            byte[] chunk = new byte[Math.Min(8192, bytes.Length - offset)];
            uint read;
            if (!ReadFile(handle, chunk, (uint)chunk.Length, out read, IntPtr.Zero)) throw NativeFailure("authority read");
            if (read == 0) throw new InvalidOperationException("Authority read was truncated.");
            Buffer.BlockCopy(chunk, 0, bytes, offset, (int)read);
            offset += (int)read;
        }
        using (SHA256 sha = SHA256.Create()) {
            byte[] digest = sha.ComputeHash(bytes);
            return BitConverter.ToString(digest).Replace("-", "").ToLowerInvariant();
        }
    }

    private static uint Hex32(string value) {
        if (value == null || value.Length != 8) throw new InvalidOperationException("Native identity is invalid.");
        return Convert.ToUInt32(value, 16);
    }

    private static ulong Hex64(string value) {
        if (value == null || value.Length != 16) throw new InvalidOperationException("Native identity is invalid.");
        return Convert.ToUInt64(value, 16);
    }

    private static uint Decimal32(string value) {
        return UInt32.Parse(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static long Decimal64(string value) {
        return Int64.Parse(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static void RequireIdentity(Identity actual, string[] args, int offset, bool includeContent) {
        if (actual.VolumeSerial != Hex32(args[offset])
            || actual.FileId != Hex64(args[offset + 1])
            || actual.Attributes != Decimal32(args[offset + 2])
            || actual.LinkCount != Decimal32(args[offset + 3])) {
            throw new InvalidOperationException("Native authority identity changed.");
        }
        if (includeContent && (actual.Size != Decimal64(args[offset + 4])
            || !String.Equals(actual.Sha256, args[offset + 5], StringComparison.Ordinal))) {
            throw new InvalidOperationException("Native authority content changed.");
        }
    }

    private static void RequireDirectory(Identity identity) {
        if ((identity.Attributes & FILE_ATTRIBUTE_DIRECTORY) == 0
            || (identity.Attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
            throw new InvalidOperationException("Authority parent is not an exact directory.");
        }
    }

    private static string FinalPath(SafeFileHandle handle) {
        StringBuilder path = new StringBuilder(32768);
        uint length = GetFinalPathNameByHandleW(handle, path, (uint)path.Capacity, 0);
        if (length == 0) throw NativeFailure("authority final-path inspection");
        if (length >= path.Capacity) throw new InvalidOperationException("Authority final path is outside the bounded contract.");
        string value = path.ToString();
        if (value.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase)) value = @"\\" + value.Substring(8);
        else if (value.StartsWith(@"\\?\", StringComparison.OrdinalIgnoreCase)) value = value.Substring(4);
        return Path.GetFullPath(value);
    }

    private static void RenameHandle(SafeFileHandle file, SafeFileHandle directory, string basename, bool replace, string phase) {
        if (String.IsNullOrWhiteSpace(basename) || basename != Path.GetFileName(basename)
            || basename.IndexOfAny(new char[] { '\\', '/', '\0', '\r', '\n' }) >= 0) {
            throw new InvalidOperationException("Authority destination name is invalid.");
        }
        string lockedDirectory = FinalPath(directory);
        byte[] name = Encoding.Unicode.GetBytes(Path.Combine(lockedDirectory, basename));
        int handleOffset = IntPtr.Size;
        int nameLengthOffset = handleOffset + IntPtr.Size;
        int nameOffset = nameLengthOffset + sizeof(uint);
        // FILE_RENAME_INFO has trailing alignment after FileName[1] on x64.
        // Allocate the native structure size plus the variable name bytes so
        // the kernel never observes a truncated structure/string boundary.
        int structureSize = IntPtr.Size == 8 ? 24 : 16;
        int bufferSize = structureSize + name.Length;
        IntPtr buffer = Marshal.AllocHGlobal(bufferSize);
        try {
            for (int index = 0; index < bufferSize; index++) Marshal.WriteByte(buffer, index, 0);
            Marshal.WriteByte(buffer, 0, replace ? (byte)1 : (byte)0);
            // SetFileInformationByHandle rejects a non-null RootDirectory on
            // supported Win32 hosts. The absolute target is derived only from
            // the locked verified directory HANDLE above, never caller text.
            Marshal.WriteIntPtr(buffer, handleOffset, IntPtr.Zero);
            Marshal.WriteInt32(buffer, nameLengthOffset, name.Length);
            Marshal.Copy(name, 0, IntPtr.Add(buffer, nameOffset), name.Length);
            if (!SetFileInformationByHandle(file, FileRenameInfo, buffer, (uint)bufferSize)) {
                throw NativeFailure("handle-relative " + phase + " rename");
            }
        } finally {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private static void DeleteHandle(SafeFileHandle file) {
        IntPtr buffer = Marshal.AllocHGlobal(sizeof(uint));
        try {
            Marshal.WriteInt32(buffer, 1);
            if (!SetFileInformationByHandle(file, FileDispositionInfo, buffer, sizeof(uint))) {
                throw NativeFailure("handle-bound cleanup");
            }
        } finally {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private static void MetadataBarrier(string directory) {
        string id = Guid.NewGuid().ToString("N");
        string source = Path.Combine(directory, ".music-fixture-barrier-" + id + ".tmp");
        string destination = Path.Combine(directory, ".music-fixture-barrier-" + id + ".done");
        using (SafeFileHandle barrier = Open(
            source,
            GENERIC_WRITE | DELETE,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            false,
            CREATE_NEW,
            FILE_FLAG_WRITE_THROUGH)) {
            if (!FlushFileBuffers(barrier)) throw NativeFailure("metadata barrier flush");
            if (!MoveFileExW(source, destination, MOVEFILE_WRITE_THROUGH)) throw NativeFailure("metadata write-through barrier");
            if (!FlushFileBuffers(barrier)) throw NativeFailure("metadata barrier verification");
            DeleteHandle(barrier);
        }
    }

    public static string InspectJson(string path) {
        string full = Path.GetFullPath(path);
        uint attributes = (uint)File.GetAttributes(full);
        bool directory = (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
        using (SafeFileHandle handle = Open(
            full,
            GENERIC_READ | FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            directory)) {
            return InspectHandle(handle, !directory, !directory).Json();
        }
    }

    public static void Replace(string[] args) {
        if (args == null || args.Length != 19) throw new InvalidOperationException("Native replace arguments are invalid.");
        string source = Path.GetFullPath(args[0]);
        string destination = Path.GetFullPath(args[1]);
        string sourceDirectory = Path.GetDirectoryName(source);
        string targetDirectory = Path.GetDirectoryName(destination);
        if (!String.Equals(sourceDirectory, targetDirectory, StringComparison.OrdinalIgnoreCase)
            || String.Equals(source, destination, StringComparison.OrdinalIgnoreCase)) {
            throw new InvalidOperationException("Native replacement must remain in one directory.");
        }
        string sourceName = Path.GetFileName(source);
        string destinationName = Path.GetFileName(destination);
        bool destinationExpected = args[12] == "1";
        if (!destinationExpected && args[12] != "0") throw new InvalidOperationException("Destination presence is invalid.");

        using (SafeFileHandle sourceParent = Open(sourceDirectory, FILE_TRAVERSE | FILE_READ_ATTRIBUTES | SYNCHRONIZE, FILE_SHARE_READ | FILE_SHARE_WRITE, true))
        using (SafeFileHandle targetParent = Open(targetDirectory, FILE_TRAVERSE | FILE_READ_ATTRIBUTES | SYNCHRONIZE, FILE_SHARE_READ | FILE_SHARE_WRITE, true)) {
            Identity sourceParentIdentity = InspectHandle(sourceParent, false, false);
            Identity targetParentIdentity = InspectHandle(targetParent, false, false);
            RequireDirectory(sourceParentIdentity);
            RequireDirectory(targetParentIdentity);
            RequireIdentity(sourceParentIdentity, args, 8, false);
            RequireIdentity(targetParentIdentity, args, 8, false);
            string lockedSourceDirectory = FinalPath(sourceParent);
            string lockedTargetDirectory = FinalPath(targetParent);
            if (!String.Equals(lockedSourceDirectory, lockedTargetDirectory, StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException("Authority parents do not resolve to one locked directory.");
            }
            string lockedSource = Path.Combine(lockedSourceDirectory, sourceName);
            string lockedDestination = Path.Combine(lockedTargetDirectory, destinationName);

            using (SafeFileHandle sourceHandle = Open(lockedSource, GENERIC_READ | GENERIC_WRITE | DELETE | FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE, false)) {
            Identity sourceIdentity = InspectHandle(sourceHandle, true, true);
            RequireIdentity(sourceIdentity, args, 2, true);

            SafeFileHandle destinationHandle = null;
            string backupName = ".music-fixture-backup-" + Guid.NewGuid().ToString("N");
            bool backupMoved = false;
            bool sourceMoved = false;
            try {
                if (destinationExpected) {
                    destinationHandle = Open(lockedDestination, GENERIC_READ | DELETE | FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE, false);
                    RequireIdentity(InspectHandle(destinationHandle, true, true), args, 13, true);
                    RenameHandle(destinationHandle, targetParent, backupName, false, "backup");
                    backupMoved = true;
                } else if (File.Exists(lockedDestination)) {
                    throw new InvalidOperationException("Unexpected destination authority exists.");
                }

                RenameHandle(sourceHandle, targetParent, destinationName, false, "commit");
                sourceMoved = true;
                RequireIdentity(InspectHandle(sourceHandle, true, true), args, 2, true);
                if (!String.Equals(FinalPath(sourceHandle), lockedDestination, StringComparison.OrdinalIgnoreCase)) {
                    throw new InvalidOperationException("Renamed authority handle resolved to an unexpected target.");
                }
                using (SafeFileHandle committedHandle = Open(lockedDestination, GENERIC_READ | FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, false)) {
                    RequireIdentity(InspectHandle(committedHandle, true, true), args, 2, true);
                }
                if (!FlushFileBuffers(sourceHandle)) throw NativeFailure("renamed authority flush");
                MetadataBarrier(lockedTargetDirectory);
                if (destinationHandle != null) DeleteHandle(destinationHandle);
            } catch {
                try {
                    if (sourceMoved) RenameHandle(sourceHandle, sourceParent, sourceName, false, "rollback-source");
                    if (backupMoved && destinationHandle != null) RenameHandle(destinationHandle, targetParent, destinationName, true, "rollback-destination");
                    if (destinationHandle != null) FlushFileBuffers(destinationHandle);
                    MetadataBarrier(lockedTargetDirectory);
                } catch {
                    // The caller reconciles exact native identity after any
                    // uncertain native result; never emit authority bytes.
                }
                throw;
            } finally {
                if (destinationHandle != null) destinationHandle.Dispose();
            }
            }
        }
    }
}
'@

if ($Operation -eq 'inspect') {
  if ($NativeArguments.Count -ne 1) { throw 'Inspect arguments are invalid.' }
  [MusicFixtureNativeAuthority]::InspectJson($NativeArguments[0])
  exit 0
}

if ($NativeArguments.Count -ne 19) { throw 'Replace arguments are invalid.' }
[MusicFixtureNativeAuthority]::Replace($NativeArguments)
