-- Inzoi Sig Bypass -FrancisLouis

local applyPatch = function(context, addr)
    context[addr] = 0xC3
end

local getIntValue = function(context, index)
    local byte1 = context[index]
    local byte2 = context[index + 1]
    local byte3 = context[index + 2]
    local byte4 = context[index + 3]

    if byte1 and byte2 and byte3 and byte4 then
        local value = byte1 | (byte2 << 8) | (byte3 << 16) | (byte4 << 24)
        if (byte4 >> 7) == 1 then
            return value - 0x100000000
        else
            return value
        end
    else
        error("Invalid index access in getIntValue at index: " .. tostring(index))
    end
end

local resolveJumpAddress = function(context, addr)
    if context[addr] == 0xE9 then
        local offset = getIntValue(context, addr + 1)
        return addr + offset + 5
    else
        print(string.format("[Inzoi] No valid jump instruction (E9) found at calculated offset: 0x%X", addr))
        return nil
    end
end

local inzoiPatch = function(context)
    local patternStartAddress = context:address() 
    local jumpInstructionRelativeOffset = 0x01 
    local jumpInstructionAddr = patternStartAddress + jumpInstructionRelativeOffset 

    print(string.format("[Inzoi] Pattern matched at: 0x%X. Targeting JMP at: 0x%X", patternStartAddress, jumpInstructionAddr))
    
    local jumpTarget = resolveJumpAddress(context, jumpInstructionAddr)
    
    if jumpTarget then
        applyPatch(context, jumpTarget)
        print("[Inzoi] Patch applied successfully at destination: 0x" .. string.format("%X", jumpTarget))
    else
        print("[Inzoi] Failed to resolve jump target address.")
    end
	
    local hiddenMessage = "57 72 69 74 74 65 6E 20 42 79 20 46 72 61 6E 63 69 73 4C 6F 75 69 73"
end

return {
    {
        match = inzoiPatch,
        pattern = '05 E9 ?? ?? ?? ?? CC CC CC CC 48 8D 0D' 
    }
}
