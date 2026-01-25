/**
 * Opcode definitions for Z-machine
 * 
 * This module defines all Z-machine opcodes with their metadata.
 * Each opcode has:
 * - Name (mnemonic)
 * - Operand count category
 * - Whether it stores a result
 * - Whether it branches
 * - Whether it has inline text
 * - Minimum version required
 * 
 * Reference: Z-Machine Specification §14 (Complete Table of Opcodes)
 * 
 * @module
 */

import { OperandCount, ZVersion } from '../../types/ZMachineTypes';

/**
 * Metadata for a single opcode
 */
export interface OpcodeInfo {
  /** Mnemonic name */
  name: string;
  /** Operand count category */
  operandCount: OperandCount;
  /** True if instruction stores a result */
  stores: boolean;
  /** True if instruction has branch data */
  branches: boolean;
  /** True if instruction has inline text */
  hasText: boolean;
  /** Minimum Z-machine version required */
  minVersion: ZVersion;
  /** Maximum Z-machine version (if removed in later versions) */
  maxVersion?: ZVersion;
}

/**
 * Create an opcode info entry
 */
function op(
  name: string,
  operandCount: OperandCount,
  options: {
    stores?: boolean;
    branches?: boolean;
    hasText?: boolean;
    minVersion?: ZVersion;
    maxVersion?: ZVersion;
  } = {}
): OpcodeInfo {
  return {
    name,
    operandCount,
    stores: options.stores ?? false,
    branches: options.branches ?? false,
    hasText: options.hasText ?? false,
    minVersion: options.minVersion ?? 1,
    maxVersion: options.maxVersion,
  };
}

/**
 * 2OP opcodes (0x00-0x1F when in 2OP form)
 * 
 * Opcode numbers are 0-31, form-independent
 */
export const OPCODES_2OP: Record<number, OpcodeInfo> = {
  // 0x00 is not used
  0x01: op('je', OperandCount.OP2, { branches: true }),      // §15: je a b ?(label)
  0x02: op('jl', OperandCount.OP2, { branches: true }),      // §15: jl a b ?(label)
  0x03: op('jg', OperandCount.OP2, { branches: true }),      // §15: jg a b ?(label)
  0x04: op('dec_chk', OperandCount.OP2, { branches: true }), // §15: dec_chk (variable) value ?(label)
  0x05: op('inc_chk', OperandCount.OP2, { branches: true }), // §15: inc_chk (variable) value ?(label)
  0x06: op('jin', OperandCount.OP2, { branches: true }),     // §15: jin obj1 obj2 ?(label)
  0x07: op('test', OperandCount.OP2, { branches: true }),    // §15: test bitmap flags ?(label)
  0x08: op('or', OperandCount.OP2, { stores: true }),        // §15: or a b -> (result)
  0x09: op('and', OperandCount.OP2, { stores: true }),       // §15: and a b -> (result)
  0x0A: op('test_attr', OperandCount.OP2, { branches: true }), // §15: test_attr object attribute ?(label)
  0x0B: op('set_attr', OperandCount.OP2),                    // §15: set_attr object attribute
  0x0C: op('clear_attr', OperandCount.OP2),                  // §15: clear_attr object attribute
  0x0D: op('store', OperandCount.OP2),                       // §15: store (variable) value
  0x0E: op('insert_obj', OperandCount.OP2),                  // §15: insert_obj object destination
  0x0F: op('loadw', OperandCount.OP2, { stores: true }),     // §15: loadw array word-index -> (result)
  0x10: op('loadb', OperandCount.OP2, { stores: true }),     // §15: loadb array byte-index -> (result)
  0x11: op('get_prop', OperandCount.OP2, { stores: true }),  // §15: get_prop object property -> (result)
  0x12: op('get_prop_addr', OperandCount.OP2, { stores: true }), // §15: get_prop_addr object property -> (result)
  0x13: op('get_next_prop', OperandCount.OP2, { stores: true }), // §15: get_next_prop object property -> (result)
  0x14: op('add', OperandCount.OP2, { stores: true }),       // §15: add a b -> (result)
  0x15: op('sub', OperandCount.OP2, { stores: true }),       // §15: sub a b -> (result)
  0x16: op('mul', OperandCount.OP2, { stores: true }),       // §15: mul a b -> (result)
  0x17: op('div', OperandCount.OP2, { stores: true }),       // §15: div a b -> (result)
  0x18: op('mod', OperandCount.OP2, { stores: true }),       // §15: mod a b -> (result)
  0x19: op('call_2s', OperandCount.OP2, { stores: true, minVersion: 4 }), // §15: call_2s routine arg1 -> (result)
  0x1A: op('call_2n', OperandCount.OP2, { minVersion: 5 }),  // §15: call_2n routine arg1
  0x1B: op('set_colour', OperandCount.OP2, { minVersion: 5 }), // §15: set_colour foreground background
  0x1C: op('throw', OperandCount.OP2, { minVersion: 5 }),    // §15: throw value stack-frame
};

/**
 * 1OP opcodes (0x00-0x0F when in 1OP form, i.e., 0x80-0x8F or 0xB0-0xBF)
 */
export const OPCODES_1OP: Record<number, OpcodeInfo> = {
  0x00: op('jz', OperandCount.OP1, { branches: true }),      // §15: jz a ?(label)
  0x01: op('get_sibling', OperandCount.OP1, { stores: true, branches: true }), // §15: get_sibling object -> (result) ?(label)
  0x02: op('get_child', OperandCount.OP1, { stores: true, branches: true }),   // §15: get_child object -> (result) ?(label)
  0x03: op('get_parent', OperandCount.OP1, { stores: true }), // §15: get_parent object -> (result)
  0x04: op('get_prop_len', OperandCount.OP1, { stores: true }), // §15: get_prop_len property-address -> (result)
  0x05: op('inc', OperandCount.OP1),                         // §15: inc (variable)
  0x06: op('dec', OperandCount.OP1),                         // §15: dec (variable)
  0x07: op('print_addr', OperandCount.OP1),                  // §15: print_addr byte-address-of-string
  0x08: op('call_1s', OperandCount.OP1, { stores: true, minVersion: 4 }), // §15: call_1s routine -> (result)
  0x09: op('remove_obj', OperandCount.OP1),                  // §15: remove_obj object
  0x0A: op('print_obj', OperandCount.OP1),                   // §15: print_obj object
  0x0B: op('ret', OperandCount.OP1),                         // §15: ret value
  0x0C: op('jump', OperandCount.OP1),                        // §15: jump ?(label) -- note: unconditional, signed offset
  0x0D: op('print_paddr', OperandCount.OP1),                 // §15: print_paddr packed-address-of-string
  0x0E: op('load', OperandCount.OP1, { stores: true }),      // §15: load (variable) -> (result)
  0x0F: op('not', OperandCount.OP1, { stores: true, maxVersion: 4 }), // §15: not value -> (result) (V1-4 only)
  // Note: In V5+, 0x0F becomes call_1n - handled by version-aware lookup
};

/**
 * V5+ override for 1OP opcode 0x0F: call_1n replaces not
 */
export const OPCODES_1OP_V5: Record<number, OpcodeInfo> = {
  0x0F: op('call_1n', OperandCount.OP1, { minVersion: 5 }), // §15: call_1n routine
};

/**
 * 0OP opcodes (0x00-0x0F when in 0OP form, i.e., 0xB0-0xBF)
 */
export const OPCODES_0OP: Record<number, OpcodeInfo> = {
  0x00: op('rtrue', OperandCount.OP0),                       // §15: rtrue
  0x01: op('rfalse', OperandCount.OP0),                      // §15: rfalse
  0x02: op('print', OperandCount.OP0, { hasText: true }),    // §15: print (literal-string)
  0x03: op('print_ret', OperandCount.OP0, { hasText: true }), // §15: print_ret (literal-string)
  0x04: op('nop', OperandCount.OP0),                         // §15: nop
  0x05: op('save', OperandCount.OP0, { branches: true, maxVersion: 3 }), // §15: save ?(label) (V1-3)
  0x06: op('restore', OperandCount.OP0, { branches: true, maxVersion: 3 }), // §15: restore ?(label) (V1-3)
  0x07: op('restart', OperandCount.OP0),                     // §15: restart
  0x08: op('ret_popped', OperandCount.OP0),                  // §15: ret_popped
  0x09: op('pop', OperandCount.OP0, { maxVersion: 4 }),      // §15: pop (V1-4) or catch -> (result) (V5+)
  0x0A: op('quit', OperandCount.OP0),                        // §15: quit
  0x0B: op('new_line', OperandCount.OP0),                    // §15: new_line
  0x0C: op('show_status', OperandCount.OP0, { minVersion: 3, maxVersion: 3 }), // §15: show_status (V3 only)
  0x0D: op('verify', OperandCount.OP0, { branches: true, minVersion: 3 }), // §15: verify ?(label)
  // 0x0E is the extended opcode prefix (0xBE)
  0x0F: op('piracy', OperandCount.OP0, { branches: true, minVersion: 5 }), // §15: piracy ?(label)
};

/**
 * V5+ override for 0OP opcode 0x09: catch replaces pop
 */
export const OPCODES_0OP_V5: Record<number, OpcodeInfo> = {
  0x09: op('catch', OperandCount.OP0, { stores: true, minVersion: 5 }), // §15: catch -> (result)
};

/**
 * V4+ override for 0OP opcodes 0x05 and 0x06: save/restore become store opcodes
 */
export const OPCODES_0OP_V4: Record<number, OpcodeInfo> = {
  0x05: op('save', OperandCount.OP0, { stores: true, minVersion: 4, maxVersion: 4 }), // §15: save -> (result) (V4)
  0x06: op('restore', OperandCount.OP0, { stores: true, minVersion: 4, maxVersion: 4 }), // §15: restore -> (result) (V4)
};

/**
 * VAR opcodes (0x00-0x1F when in VAR form, i.e., 0xE0-0xFF)
 */
export const OPCODES_VAR: Record<number, OpcodeInfo> = {
  0x00: op('call', OperandCount.VAR, { stores: true }),      // §15: call routine ...args -> (result) (V1-3) or call_vs
  0x01: op('storew', OperandCount.VAR),                      // §15: storew array word-index value
  0x02: op('storeb', OperandCount.VAR),                      // §15: storeb array byte-index value
  0x03: op('put_prop', OperandCount.VAR),                    // §15: put_prop object property value
  0x04: op('sread', OperandCount.VAR),                       // §15: sread text parse (V1-3) or aread (V5+)
  0x05: op('print_char', OperandCount.VAR),                  // §15: print_char output-character-code
  0x06: op('print_num', OperandCount.VAR),                   // §15: print_num value
  0x07: op('random', OperandCount.VAR, { stores: true }),    // §15: random range -> (result)
  0x08: op('push', OperandCount.VAR),                        // §15: push value
  0x09: op('pull', OperandCount.VAR),                        // §15: pull (variable) (V1-5) or pull stack -> (result) (V6)
  0x0A: op('split_window', OperandCount.VAR, { minVersion: 3 }), // §15: split_window lines
  0x0B: op('set_window', OperandCount.VAR, { minVersion: 3 }), // §15: set_window window
  0x0C: op('call_vs2', OperandCount.VAR, { stores: true, minVersion: 4 }), // §15: call_vs2 routine ...args -> (result)
  0x0D: op('erase_window', OperandCount.VAR, { minVersion: 4 }), // §15: erase_window window
  0x0E: op('erase_line', OperandCount.VAR, { minVersion: 4 }), // §15: erase_line value
  0x0F: op('set_cursor', OperandCount.VAR, { minVersion: 4 }), // §15: set_cursor line column
  0x10: op('get_cursor', OperandCount.VAR, { minVersion: 4 }), // §15: get_cursor array
  0x11: op('set_text_style', OperandCount.VAR, { minVersion: 4 }), // §15: set_text_style style
  0x12: op('buffer_mode', OperandCount.VAR, { minVersion: 4 }), // §15: buffer_mode flag
  0x13: op('output_stream', OperandCount.VAR, { minVersion: 3 }), // §15: output_stream number
  0x14: op('input_stream', OperandCount.VAR, { minVersion: 3 }), // §15: input_stream number
  0x15: op('sound_effect', OperandCount.VAR, { minVersion: 3 }), // §15: sound_effect number
  0x16: op('read_char', OperandCount.VAR, { stores: true, minVersion: 4 }), // §15: read_char 1 time routine -> (result)
  0x17: op('scan_table', OperandCount.VAR, { stores: true, branches: true, minVersion: 4 }), // §15: scan_table x table len form -> (result)
  0x18: op('not', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: not value -> (result) (V5+)
  0x19: op('call_vn', OperandCount.VAR, { minVersion: 5 }),  // §15: call_vn routine ...args
  0x1A: op('call_vn2', OperandCount.VAR, { minVersion: 5 }), // §15: call_vn2 routine ...args
  0x1B: op('tokenise', OperandCount.VAR, { minVersion: 5 }), // §15: tokenise text parse dictionary flag
  0x1C: op('encode_text', OperandCount.VAR, { minVersion: 5 }), // §15: encode_text zscii-text length from coded-text
  0x1D: op('copy_table', OperandCount.VAR, { minVersion: 5 }), // §15: copy_table first second size
  0x1E: op('print_table', OperandCount.VAR, { minVersion: 5 }), // §15: print_table zscii-text width height skip
  0x1F: op('check_arg_count', OperandCount.VAR, { branches: true, minVersion: 5 }), // §15: check_arg_count argument-number
};

/**
 * Extended opcodes (accessed via 0xBE prefix, V5+)
 */
export const OPCODES_EXT: Record<number, OpcodeInfo> = {
  0x00: op('save', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: save table bytes name -> (result)
  0x01: op('restore', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: restore table bytes name -> (result)
  0x02: op('log_shift', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: log_shift number places -> (result)
  0x03: op('art_shift', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: art_shift number places -> (result)
  0x04: op('set_font', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: set_font font -> (result)
  // 0x05-0x08 are V6 graphics opcodes
  0x09: op('save_undo', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: save_undo -> (result)
  0x0A: op('restore_undo', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: restore_undo -> (result)
  0x0B: op('print_unicode', OperandCount.VAR, { minVersion: 5 }), // §15: print_unicode char-code
  0x0C: op('check_unicode', OperandCount.VAR, { stores: true, minVersion: 5 }), // §15: check_unicode char-code -> (result)
  0x0D: op('set_true_colour', OperandCount.VAR, { minVersion: 5 }), // §15: set_true_colour foreground background
};

/**
 * Get opcode info for a 2OP opcode
 */
export function get2OPInfo(opcode: number): OpcodeInfo | undefined {
  return OPCODES_2OP[opcode];
}

/**
 * Get opcode info for a 1OP opcode (version-aware)
 */
export function get1OPInfo(opcode: number, version: number = 3): OpcodeInfo | undefined {
  // V5+ overrides
  if (version >= 5 && opcode in OPCODES_1OP_V5) {
    return OPCODES_1OP_V5[opcode];
  }
  return OPCODES_1OP[opcode];
}

/**
 * Get opcode info for a 0OP opcode (version-aware)
 */
export function get0OPInfo(opcode: number, version: number = 3): OpcodeInfo | undefined {
  // V5+ overrides (catch replaces pop)
  if (version >= 5 && opcode in OPCODES_0OP_V5) {
    return OPCODES_0OP_V5[opcode];
  }
  // V4 overrides (save/restore become store opcodes)
  if (version === 4 && opcode in OPCODES_0OP_V4) {
    return OPCODES_0OP_V4[opcode];
  }
  // V5+ save/restore are illegal as 0OP - they use EXT form
  if (version >= 5 && (opcode === 0x05 || opcode === 0x06)) {
    return undefined; // Illegal in V5+
  }
  return OPCODES_0OP[opcode];
}

/**
 * Get opcode info for a VAR opcode
 */
export function getVARInfo(opcode: number): OpcodeInfo | undefined {
  return OPCODES_VAR[opcode];
}

/**
 * Get opcode info for an extended opcode
 */
export function getEXTInfo(opcode: number): OpcodeInfo | undefined {
  return OPCODES_EXT[opcode];
}
