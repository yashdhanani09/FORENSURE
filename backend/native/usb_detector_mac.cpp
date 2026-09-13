#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/IOKitLib.h>
#include <IOKit/storage/IOMedia.h>
#include <IOKit/storage/IOBlockStorageDevice.h>
#include <IOKit/usb/IOUSBLib.h>
#include <IOKit/IOBSD.h>
#include <DiskArbitration/DiskArbitration.h>
#include <iostream>
#include <string>
#include <vector>

std::string getCFString(CFStringRef str) {
    if (!str) return "";
    char buffer[1024];
    if (CFStringGetCString(str, buffer, sizeof(buffer), kCFStringEncodingUTF8)) {
        return std::string(buffer);
    }
    return "";
}

std::string getURLPath(CFURLRef url) {
    if (!url) return "";
    char buffer[1024];
    if (CFURLGetFileSystemRepresentation(url, true, (UInt8*)buffer, sizeof(buffer))) {
        return std::string(buffer);
    }
    return "";
}

std::string getUUIDString(CFTypeRef uuidRef) {
    if (!uuidRef) return "";
    if (CFGetTypeID(uuidRef) == CFUUIDGetTypeID()) {
        CFStringRef str = CFUUIDCreateString(kCFAllocatorDefault, (CFUUIDRef)uuidRef);
        std::string res = getCFString(str);
        if (str) CFRelease(str);
        return res;
    } else if (CFGetTypeID(uuidRef) == CFStringGetTypeID()) {
        return getCFString((CFStringRef)uuidRef);
    }
    return "";
}

std::string getPropertyString(io_registry_entry_t entry, const char* key) {
    CFStringRef cfKey = CFStringCreateWithCString(kCFAllocatorDefault, key, kCFStringEncodingUTF8);
    CFTypeRef cfProp = IORegistryEntryCreateCFProperty(entry, cfKey, kCFAllocatorDefault, 0);
    if (cfKey) CFRelease(cfKey);

    std::string result = "";
    if (cfProp) {
        if (CFGetTypeID(cfProp) == CFStringGetTypeID()) {
            result = getCFString((CFStringRef)cfProp);
        }
        CFRelease(cfProp);
    }
    return result;
}

uint64_t getPropertyUInt64(io_registry_entry_t entry, const char* key) {
    CFStringRef cfKey = CFStringCreateWithCString(kCFAllocatorDefault, key, kCFStringEncodingUTF8);
    CFTypeRef cfProp = IORegistryEntryCreateCFProperty(entry, cfKey, kCFAllocatorDefault, 0);
    if (cfKey) CFRelease(cfKey);

    uint64_t result = 0;
    if (cfProp) {
        if (CFGetTypeID(cfProp) == CFNumberGetTypeID()) {
            CFNumberGetValue((CFNumberRef)cfProp, kCFNumberSInt64Type, &result);
        }
        CFRelease(cfProp);
    }
    return result;
}

bool getPropertyBool(io_registry_entry_t entry, const char* key) {
    CFStringRef cfKey = CFStringCreateWithCString(kCFAllocatorDefault, key, kCFStringEncodingUTF8);
    CFTypeRef cfProp = IORegistryEntryCreateCFProperty(entry, cfKey, kCFAllocatorDefault, 0);
    if (cfKey) CFRelease(cfKey);

    bool result = false;
    if (cfProp) {
        if (CFGetTypeID(cfProp) == CFBooleanGetTypeID()) {
            result = CFBooleanGetValue((CFBooleanRef)cfProp);
        }
        CFRelease(cfProp);
    }
    return result;
}

std::string escapeJSON(const std::string& input) {
    std::string output;
    for (char c : input) {
        if (c == '"') output += "\\\"";
        else if (c == '\\') output += "\\\\";
        else output += c;
    }
    return output;
}

int main() {
    DASessionRef session = DASessionCreate(kCFAllocatorDefault);
    CFMutableDictionaryRef matchingDict = IOServiceMatching(kIOMediaClass);
    io_iterator_t iter;
    kern_return_t kr = IOServiceGetMatchingServices(kIOMainPortDefault, matchingDict, &iter);

    if (kr != KERN_SUCCESS) {
        std::cerr << "Failed to get matching services." << std::endl;
        if (session) CFRelease(session);
        return 1;
    }

    std::cout << "{" << std::endl;
    std::cout << "  \"blockdevices\": [" << std::endl;

    io_object_t media;
    bool firstNode = true;

    while ((media = IOIteratorNext(iter)) != 0) {
        bool isWhole = getPropertyBool(media, kIOMediaWholeKey);
        bool isEjectable = getPropertyBool(media, kIOMediaEjectableKey);
        
        // We only care about whole, ejectable/removable disks (like USBs)
        if (isWhole && isEjectable) {
            std::string bsdName = getPropertyString(media, kIOBSDNameKey);
            uint64_t size = getPropertyUInt64(media, kIOMediaSizeKey);
            bool isWritable = getPropertyBool(media, kIOMediaWritableKey);

            std::string vendor = "";
            std::string model = "";
            std::string serial = "";
            std::string protocol = "";

            io_registry_entry_t parent;
            kern_return_t parent_kr = IORegistryEntryGetParentEntry(media, kIOServicePlane, &parent);
            
            int max_depth = 10;
            while (parent_kr == KERN_SUCCESS && parent != 0 && max_depth > 0) {
                if (vendor.empty()) vendor = getPropertyString(parent, "USB Vendor Name");
                if (model.empty()) model = getPropertyString(parent, "USB Product Name");
                if (serial.empty()) serial = getPropertyString(parent, "USB Serial Number");
                
                if (vendor.empty()) vendor = getPropertyString(parent, "Device Characteristics\\Vendor Name");
                if (model.empty()) model = getPropertyString(parent, "Device Characteristics\\Product Name");
                if (protocol.empty()) protocol = getPropertyString(parent, "Physical Interconnect");

                io_registry_entry_t nextParent;
                parent_kr = IORegistryEntryGetParentEntry(parent, kIOServicePlane, &nextParent);
                IOObjectRelease(parent);
                parent = nextParent;
                max_depth--;
            }
            if (parent != 0) IOObjectRelease(parent);

            if (!firstNode) std::cout << "," << std::endl;
            firstNode = false;

            std::cout << "    {" << std::endl;
            std::cout << "      \"name\": \"" << escapeJSON(bsdName) << "\"," << std::endl;
            std::cout << "      \"path\": \"/dev/" << escapeJSON(bsdName) << "\"," << std::endl;
            std::cout << "      \"size\": " << size << "," << std::endl;
            std::cout << "      \"vendor\": \"" << escapeJSON(vendor) << "\"," << std::endl;
            std::cout << "      \"model\": \"" << escapeJSON(model) << "\"," << std::endl;
            std::cout << "      \"serial\": \"" << escapeJSON(serial) << "\"," << std::endl;
            std::cout << "      \"rm\": true," << std::endl;
            std::cout << "      \"ro\": " << (isWritable ? "false" : "true") << "," << std::endl;
            std::cout << "      \"tran\": \"" << (protocol.empty() ? "usb" : escapeJSON(protocol)) << "\"," << std::endl;
            std::cout << "      \"type\": \"disk\"," << std::endl;
            std::cout << "      \"children\": [" << std::endl;
            
            // Find child partitions
            io_iterator_t childIter;
            if (IORegistryEntryCreateIterator(media, kIOServicePlane, kIORegistryIterateRecursively, &childIter) == KERN_SUCCESS) {
                io_object_t child;
                bool firstChild = true;
                while ((child = IOIteratorNext(childIter)) != 0) {
                    bool isLeaf = getPropertyBool(child, kIOMediaLeafKey);
                    bool childIsWhole = getPropertyBool(child, kIOMediaWholeKey);
                    std::string childBsdName = getPropertyString(child, kIOBSDNameKey);
                    
                    if (isLeaf && !childIsWhole && !childBsdName.empty()) {
                        uint64_t childSize = getPropertyUInt64(child, kIOMediaSizeKey);
                        
                        std::string volName = "";
                        std::string volKind = "";
                        std::string volPath = "";
                        std::string volUUID = "";
                        
                        DADiskRef disk = DADiskCreateFromBSDName(kCFAllocatorDefault, session, childBsdName.c_str());
                        if (disk) {
                            CFDictionaryRef desc = DADiskCopyDescription(disk);
                            if (desc) {
                                CFTypeRef nameRef = CFDictionaryGetValue(desc, kDADiskDescriptionVolumeNameKey);
                                if (nameRef) volName = getCFString((CFStringRef)nameRef);
                                
                                CFTypeRef kindRef = CFDictionaryGetValue(desc, kDADiskDescriptionVolumeKindKey);
                                if (kindRef) volKind = getCFString((CFStringRef)kindRef);
                                
                                CFTypeRef pathRef = CFDictionaryGetValue(desc, kDADiskDescriptionVolumePathKey);
                                if (pathRef) volPath = getURLPath((CFURLRef)pathRef);
                                
                                CFTypeRef uuidRef = CFDictionaryGetValue(desc, kDADiskDescriptionVolumeUUIDKey);
                                if (uuidRef) volUUID = getUUIDString(uuidRef);
                                
                                CFRelease(desc);
                            }
                            CFRelease(disk);
                        }
                        
                        if (!firstChild) std::cout << "," << std::endl;
                        firstChild = false;
                        
                        std::cout << "        {" << std::endl;
                        std::cout << "          \"name\": \"" << escapeJSON(childBsdName) << "\"," << std::endl;
                        std::cout << "          \"path\": \"/dev/" << escapeJSON(childBsdName) << "\"," << std::endl;
                        std::cout << "          \"type\": \"part\"," << std::endl;
                        std::cout << "          \"size\": " << childSize << "," << std::endl;
                        std::cout << "          \"label\": \"" << escapeJSON(volName) << "\"," << std::endl;
                        std::cout << "          \"fstype\": \"" << escapeJSON(volKind) << "\"," << std::endl;
                        std::cout << "          \"uuid\": \"" << escapeJSON(volUUID) << "\"," << std::endl;
                        std::cout << "          \"mountpoints\": " << (volPath.empty() ? "[]" : "[\"" + escapeJSON(volPath) + "\"]") << std::endl;
                        std::cout << "        }";
                    }
                    IOObjectRelease(child);
                }
                IOObjectRelease(childIter);
            }
            std::cout << std::endl << "      ]" << std::endl;
            std::cout << "    }";
        }
        IOObjectRelease(media);
    }
    
    std::cout << std::endl << "  ]" << std::endl;
    std::cout << "}" << std::endl;

    IOObjectRelease(iter);
    if (session) CFRelease(session);
    return 0;
}
