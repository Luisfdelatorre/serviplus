using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Drawing.Printing;

namespace RawPrinter
{
    class Program
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
        }

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

        public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes, string docName = "Receipt")
        {
            IntPtr hPrinter = IntPtr.Zero;
            DOCINFOA di = new DOCINFOA();
            di.pDocName = docName;
            di.pDataType = "RAW";

            if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                if (StartDocPrinter(hPrinter, 1, di))
                {
                    if (StartPagePrinter(hPrinter))
                    {
                        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                        int dwWritten = 0;
                        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                        EndPagePrinter(hPrinter);
                        EndDocPrinter(hPrinter);
                        ClosePrinter(hPrinter);
                        return success;
                    }
                    EndDocPrinter(hPrinter);
                }
                ClosePrinter(hPrinter);
            }
            return false;
        }

        static int Main(string[] args)
        {
            try
            {
                if (args.Length == 0 || args[0] == "--help" || args[0] == "-h")
                {
                    Console.WriteLine("Usage: rawprint.exe <printerName> <filePath>");
                    Console.WriteLine("       rawprint.exe --list");
                    return 0;
                }

                if (args[0] == "--list" || args[0] == "-l")
                {
                    foreach (string printer in PrinterSettings.InstalledPrinters)
                    {
                        Console.WriteLine(printer);
                    }
                    return 0;
                }

                string printerName = args[0];
                byte[] data;

                if (args.Length > 1)
                {
                    string filePath = args[1];
                    if (!File.Exists(filePath))
                    {
                        Console.Error.WriteLine("File not found: " + filePath);
                        return 1;
                    }
                    data = File.ReadAllBytes(filePath);
                }
                else
                {
                    using (MemoryStream ms = new MemoryStream())
                    {
                        using (Stream s = Console.OpenStandardInput())
                        {
                            s.CopyTo(ms);
                        }
                        data = ms.ToArray();
                    }
                }

                if (data == null || data.Length == 0)
                {
                    Console.Error.WriteLine("No data to print.");
                    return 1;
                }

                bool result = SendBytesToPrinter(printerName, data, "Serviplus Receipt");
                if (result)
                {
                    Console.WriteLine("Printed successfully (" + data.Length + " bytes to " + printerName + ")");
                    return 0;
                }
                else
                {
                    int err = Marshal.GetLastWin32Error();
                    Console.Error.WriteLine("Failed to print to '" + printerName + "'. Win32 Error: " + err);
                    return 1;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Exception: " + ex.Message);
                return 1;
            }
        }
    }
}

