/**
 * Tests for ObjectTable and Properties modules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectTable } from './ObjectTable';
import { Properties } from './Properties';
import { Memory } from '../memory/Memory';

describe('ObjectTable', () => {
  let memory: Memory;

  function createTestMemory(): Memory {
    const size = 0x10000;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header - set in buffer before creating Memory
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x0a, 0x100, false); // Object table at 0x100
    view.setUint16(0x0e, 0x8000, false); // Static memory base (for writability)

    return new Memory(buffer);
  }

  function setupV3ObjectTable(mem: Memory): void {
    const tableAddr = 0x100;

    // Property defaults (31 words = 62 bytes)
    for (let i = 0; i < 31; i++) {
      mem.writeWord(tableAddr + i * 2, (i + 1) * 10);
    }

    // Object entries start at tableAddr + 62
    const objStart = tableAddr + 62;

    // Object 1: Room (parent=0, sibling=0, child=2)
    // Attributes: bit 0 set (attribute 0), bit 4 set (attribute 4)
    const obj1Addr = objStart;
    mem.writeByte(obj1Addr, 0x88); // Attrs byte 0: bits 7 and 3 set = attrs 0 and 4
    mem.writeByte(obj1Addr + 1, 0x00);
    mem.writeByte(obj1Addr + 2, 0x00);
    mem.writeByte(obj1Addr + 3, 0x00);
    mem.writeByte(obj1Addr + 4, 0); // Parent
    mem.writeByte(obj1Addr + 5, 0); // Sibling
    mem.writeByte(obj1Addr + 6, 2); // Child
    mem.writeWord(obj1Addr + 7, 0x200); // Property table

    // Object 2: Lamp (parent=1, sibling=3, child=0)
    const obj2Addr = objStart + 9;
    mem.writeByte(obj2Addr, 0x00);
    mem.writeByte(obj2Addr + 1, 0x00);
    mem.writeByte(obj2Addr + 2, 0x00);
    mem.writeByte(obj2Addr + 3, 0x00);
    mem.writeByte(obj2Addr + 4, 1); // Parent
    mem.writeByte(obj2Addr + 5, 3); // Sibling
    mem.writeByte(obj2Addr + 6, 0); // Child
    mem.writeWord(obj2Addr + 7, 0x220); // Property table

    // Object 3: Sword (parent=1, sibling=0, child=0)
    const obj3Addr = objStart + 18;
    mem.writeByte(obj3Addr, 0x00);
    mem.writeByte(obj3Addr + 1, 0x00);
    mem.writeByte(obj3Addr + 2, 0x00);
    mem.writeByte(obj3Addr + 3, 0x00);
    mem.writeByte(obj3Addr + 4, 1); // Parent
    mem.writeByte(obj3Addr + 5, 0); // Sibling
    mem.writeByte(obj3Addr + 6, 0); // Child
    mem.writeWord(obj3Addr + 7, 0x240); // Property table
  }

  beforeEach(() => {
    memory = createTestMemory();
    setupV3ObjectTable(memory);
  });

  describe('construction', () => {
    it('should calculate correct entry size for V3', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.entrySize).toBe(9);
      expect(table.attrBytes).toBe(4);
      expect(table.maxObjects).toBe(255);
    });

    it('should calculate correct entry size for V5', () => {
      const table = new ObjectTable(memory, 5, 0x100);
      expect(table.entrySize).toBe(14);
      expect(table.attrBytes).toBe(6);
      expect(table.maxObjects).toBe(65535);
    });
  });

  describe('tree navigation', () => {
    it('should get parent of object', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.getParent(1)).toBe(0);
      expect(table.getParent(2)).toBe(1);
      expect(table.getParent(3)).toBe(1);
    });

    it('should get sibling of object', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.getSibling(1)).toBe(0);
      expect(table.getSibling(2)).toBe(3);
      expect(table.getSibling(3)).toBe(0);
    });

    it('should get child of object', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.getChild(1)).toBe(2);
      expect(table.getChild(2)).toBe(0);
      expect(table.getChild(3)).toBe(0);
    });

    it('should set parent', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      table.setParent(2, 0);
      expect(table.getParent(2)).toBe(0);
    });

    it('should set sibling', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      table.setSibling(2, 0);
      expect(table.getSibling(2)).toBe(0);
    });

    it('should set child', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      table.setChild(1, 3);
      expect(table.getChild(1)).toBe(3);
    });
  });

  describe('attributes', () => {
    it('should test attribute that is set', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.testAttribute(1, 0)).toBe(true);
      expect(table.testAttribute(1, 4)).toBe(true);
    });

    it('should test attribute that is not set', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.testAttribute(1, 1)).toBe(false);
      expect(table.testAttribute(1, 2)).toBe(false);
    });

    it('should set attribute', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.testAttribute(1, 1)).toBe(false);
      table.setAttribute(1, 1);
      expect(table.testAttribute(1, 1)).toBe(true);
    });

    it('should clear attribute', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.testAttribute(1, 0)).toBe(true);
      table.clearAttribute(1, 0);
      expect(table.testAttribute(1, 0)).toBe(false);
    });

    it('should handle attributes in different bytes', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      // Attribute 8 is in byte 1
      table.setAttribute(1, 8);
      expect(table.testAttribute(1, 8)).toBe(true);
      // Attribute 16 is in byte 2
      table.setAttribute(1, 16);
      expect(table.testAttribute(1, 16)).toBe(true);
    });

    it('should reject invalid attribute numbers', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(() => table.testAttribute(1, 32)).toThrow();
      expect(() => table.testAttribute(1, -1)).toThrow();
    });

    it('should reject invalid attribute numbers in clearAttribute', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(() => table.clearAttribute(1, 32)).toThrow('Invalid attribute number: 32');
      expect(() => table.clearAttribute(1, -1)).toThrow('Invalid attribute number: -1');
    });

    it('should reject invalid attribute numbers in setAttribute', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(() => table.setAttribute(1, 32)).toThrow('Invalid attribute number: 32');
      expect(() => table.setAttribute(1, -1)).toThrow('Invalid attribute number: -1');
    });
  });

  describe('object address', () => {
    it('should reject invalid object numbers', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(() => table.getObjectAddress(0)).toThrow('Invalid object number (object: 0)');
      expect(() => table.getObjectAddress(-1)).toThrow('Invalid object number (object: -1)');
      expect(() => table.getObjectAddress(256)).toThrow('Invalid object number (object: 256)');
    });
  });

  describe('tree manipulation', () => {
    it('should remove object from parent (first child)', () => {
      const table = new ObjectTable(memory, 3, 0x100);

      // Object 2 is first child of 1
      expect(table.getChild(1)).toBe(2);
      expect(table.getSibling(2)).toBe(3);

      table.removeFromParent(2);

      // Object 3 should now be first child
      expect(table.getChild(1)).toBe(3);
      expect(table.getParent(2)).toBe(0);
      expect(table.getSibling(2)).toBe(0);
    });

    it('should remove object from parent (middle/last child)', () => {
      const table = new ObjectTable(memory, 3, 0x100);

      // Object 3 is sibling of 2
      table.removeFromParent(3);

      expect(table.getSibling(2)).toBe(0);
      expect(table.getParent(3)).toBe(0);
    });

    it('should insert object into new parent', () => {
      const table = new ObjectTable(memory, 3, 0x100);

      // Move object 3 to be child of 2
      table.insertObject(3, 2);

      expect(table.getParent(3)).toBe(2);
      expect(table.getChild(2)).toBe(3);
      expect(table.getSibling(2)).toBe(0); // No longer sibling
    });

    it('should handle insert when destination has existing children', () => {
      const table = new ObjectTable(memory, 3, 0x100);

      // Add object 3 as child of 2 first
      table.insertObject(3, 2);
      expect(table.getChild(2)).toBe(3);

      // Now move object 2 out (orphan it)
      table.removeFromParent(2);

      // Insert object 2 back into object 1
      table.insertObject(2, 1);
      expect(table.getChild(1)).toBe(2);
    });
  });

  describe('property table', () => {
    it('should get property table address', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.getPropertyTableAddress(1)).toBe(0x200);
      expect(table.getPropertyTableAddress(2)).toBe(0x220);
    });

    it('should get property default', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(table.getPropertyDefault(1)).toBe(10);
      expect(table.getPropertyDefault(10)).toBe(100);
    });

    it('should reject invalid property numbers in getPropertyDefault', () => {
      const table = new ObjectTable(memory, 3, 0x100);
      expect(() => table.getPropertyDefault(0)).toThrow('Invalid property number: 0');
      expect(() => table.getPropertyDefault(32)).toThrow('Invalid property number: 32');
      expect(() => table.getPropertyDefault(-1)).toThrow('Invalid property number: -1');
    });
  });
});

describe('Properties', () => {
  let memory: Memory;

  function createTestMemory(): Memory {
    const size = 0x10000;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header - set in buffer before creating Memory
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x0a, 0x100, false); // Object table at 0x100
    view.setUint16(0x0e, 0x8000, false); // Static memory base (for writability)

    return new Memory(buffer);
  }

  function setupV3ObjectWithProperties(mem: Memory): void {
    const tableAddr = 0x100;

    // Property defaults (31 words)
    for (let i = 0; i < 31; i++) {
      mem.writeWord(tableAddr + i * 2, (i + 1) * 100);
    }

    // Object 1 entry at tableAddr + 62
    const objStart = tableAddr + 62;
    mem.writeByte(objStart, 0x00); // Attrs
    mem.writeByte(objStart + 1, 0x00);
    mem.writeByte(objStart + 2, 0x00);
    mem.writeByte(objStart + 3, 0x00);
    mem.writeByte(objStart + 4, 0); // Parent
    mem.writeByte(objStart + 5, 0); // Sibling
    mem.writeByte(objStart + 6, 0); // Child
    mem.writeWord(objStart + 7, 0x200); // Property table

    // Property table at 0x200
    const propTable = 0x200;

    // Short name: 2 words (4 bytes) = "test"
    mem.writeByte(propTable, 2); // Length in words
    // Skip actual text for now

    // Properties start at propTable + 1 + 4 = 0x205
    let propAddr = propTable + 5;

    // Property 18: 2 bytes of data (size = 1, so size byte = (1 << 5) | 18 = 0x32)
    mem.writeByte(propAddr, 0x32); // Size 2, prop 18
    mem.writeWord(propAddr + 1, 0xabcd); // Data
    propAddr += 3;

    // Property 10: 1 byte of data (size = 0, so size byte = (0 << 5) | 10 = 0x0A)
    mem.writeByte(propAddr, 0x0a); // Size 1, prop 10
    mem.writeByte(propAddr + 1, 0x42); // Data
    propAddr += 2;

    // Property 5: 4 bytes of data (size = 3, so size byte = (3 << 5) | 5 = 0x65)
    mem.writeByte(propAddr, 0x65); // Size 4, prop 5
    mem.writeByte(propAddr + 1, 0x11);
    mem.writeByte(propAddr + 2, 0x22);
    mem.writeByte(propAddr + 3, 0x33);
    mem.writeByte(propAddr + 4, 0x44);
    propAddr += 5;

    // End of properties
    mem.writeByte(propAddr, 0x00);
  }

  beforeEach(() => {
    memory = createTestMemory();
    setupV3ObjectWithProperties(memory);
  });

  describe('property access', () => {
    it('should get 2-byte property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const value = props.getProperty(1, 18);
      expect(value).toBe(0xabcd);
    });

    it('should get 1-byte property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const value = props.getProperty(1, 10);
      expect(value).toBe(0x42);
    });

    it('should return default for missing property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      // Property 20 doesn't exist, default is 20 * 100 = 2000
      const value = props.getProperty(1, 20);
      expect(value).toBe(2000);
    });

    it('should put 2-byte property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      props.putProperty(1, 18, 0x1234);
      expect(props.getProperty(1, 18)).toBe(0x1234);
    });

    it('should put 1-byte property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      props.putProperty(1, 10, 0xff);
      expect(props.getProperty(1, 10)).toBe(0xff);
    });

    it('should throw when putting property with length > 2', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      // Property 5 has length 4, which is too long for put_prop
      expect(() => props.putProperty(1, 5, 0x1234)).toThrow(
        'Cannot put_prop on property of length 4'
      );
    });

    it('should throw when putting non-existent property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      // Property 25 doesn't exist on object 1
      expect(() => props.putProperty(1, 25, 0x1234)).toThrow('Property 25 not found (object: 1)');
    });

    it('should get first word for property with length > 2', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      // Property 5 has length 4 bytes: 0x11, 0x22, 0x33, 0x44
      // getProperty should return the first word (0x1122)
      const value = props.getProperty(1, 5);
      expect(value).toBe(0x1122);
    });
  });

  describe('property enumeration', () => {
    it('should get first property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const first = props.getNextProperty(1, 0);
      expect(first).toBe(18);
    });

    it('should get next property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const next = props.getNextProperty(1, 18);
      expect(next).toBe(10);
    });

    it('should return 0 after last property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const last = props.getNextProperty(1, 5);
      expect(last).toBe(0);
    });

    it('should throw when getting next property for non-existent property', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      // Property 25 doesn't exist on object 1
      expect(() => props.getNextProperty(1, 25)).toThrow('Property 25 not found (object: 1)');
    });

    it('should return 0 for first property of object with no properties', () => {
      // Create a new memory with an object that has no properties
      const testMem = ((): Memory => {
        const size = 0x10000;
        const buffer = new ArrayBuffer(size);
        const view = new DataView(buffer);

        // Header
        view.setUint8(0x00, 3); // Version 3
        view.setUint16(0x0a, 0x100, false); // Object table at 0x100
        view.setUint16(0x0e, 0x8000, false); // Static memory base

        return new Memory(buffer);
      })();

      const tableAddr = 0x100;

      // Property defaults (31 words)
      for (let i = 0; i < 31; i++) {
        testMem.writeWord(tableAddr + i * 2, (i + 1) * 100);
      }

      // Object 1 entry at tableAddr + 62
      const objStart = tableAddr + 62;
      testMem.writeByte(objStart, 0x00); // Attrs
      testMem.writeByte(objStart + 1, 0x00);
      testMem.writeByte(objStart + 2, 0x00);
      testMem.writeByte(objStart + 3, 0x00);
      testMem.writeByte(objStart + 4, 0); // Parent
      testMem.writeByte(objStart + 5, 0); // Sibling
      testMem.writeByte(objStart + 6, 0); // Child
      testMem.writeWord(objStart + 7, 0x200); // Property table

      // Property table at 0x200 with NO properties
      const propTable = 0x200;
      testMem.writeByte(propTable, 0); // Short name length = 0 (no name)
      testMem.writeByte(propTable + 1, 0x00); // End of properties immediately

      const objTable = new ObjectTable(testMem, 3, 0x100);
      const props = new Properties(testMem, 3, objTable);

      // getNextProperty(objNum, 0) should return 0 when object has no properties
      const first = props.getNextProperty(1, 0);
      expect(first).toBe(0);
    });
  });

  describe('property address and length', () => {
    it('should get property address', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const addr = props.getPropertyAddress(1, 18);
      expect(addr).toBeGreaterThan(0);
      expect(memory.readWord(addr)).toBe(0xabcd);
    });

    it('should return 0 for missing property address', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const addr = props.getPropertyAddress(1, 25);
      expect(addr).toBe(0);
    });

    it('should get property length from address', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      const addr18 = props.getPropertyAddress(1, 18);
      expect(props.getPropertyLength(addr18)).toBe(2);

      const addr10 = props.getPropertyAddress(1, 10);
      expect(props.getPropertyLength(addr10)).toBe(1);

      const addr5 = props.getPropertyAddress(1, 5);
      expect(props.getPropertyLength(addr5)).toBe(4);
    });

    it('should return 0 for address 0', () => {
      const objTable = new ObjectTable(memory, 3, 0x100);
      const props = new Properties(memory, 3, objTable);

      expect(props.getPropertyLength(0)).toBe(0);
    });
  });

  describe('V5 property format', () => {
    function setupV5Memory(): Memory {
      const size = 0x10000;
      const buffer = new ArrayBuffer(size);
      const view = new DataView(buffer);

      view.setUint8(0x00, 5); // Version 5
      view.setUint16(0x0a, 0x100, false); // Object table
      view.setUint16(0x0e, 0x8000, false); // Static memory base

      return new Memory(buffer);
    }

    function setupV5ObjectTable(mem: Memory): void {
      const tableAddr = 0x100;

      // Property defaults (63 words = 126 bytes)
      for (let i = 0; i < 63; i++) {
        mem.writeWord(tableAddr + i * 2, (i + 1) * 10);
      }

      // Object entries start at tableAddr + 126
      const objStart = tableAddr + 126;

      // Object 1 (14 bytes for V5)
      const obj1Addr = objStart;
      // 6 bytes attributes
      for (let i = 0; i < 6; i++) {
        mem.writeByte(obj1Addr + i, 0);
      }
      mem.writeWord(obj1Addr + 6, 0); // Parent
      mem.writeWord(obj1Addr + 8, 0); // Sibling
      mem.writeWord(obj1Addr + 10, 0); // Child
      mem.writeWord(obj1Addr + 12, 0x300); // Property table

      // Property table at 0x300
      const propTableAddr = 0x300;
      // Short name length
      mem.writeByte(propTableAddr, 0); // No name

      // Properties start at propTableAddr + 1
      let propAddr = propTableAddr + 1;

      // 1-byte header property (prop 10, length 1)
      // Format: 0b0SPPPPPP where S=size-1 (0 or 1), P=prop number
      mem.writeByte(propAddr, 10); // prop 10, size 1 (bit 6 clear)
      propAddr++;
      mem.writeByte(propAddr, 0x42); // data
      propAddr++;

      // 1-byte header property (prop 8, length 2)
      mem.writeByte(propAddr, 0x48); // prop 8, size 2 (bit 6 set = 0x40 | 8)
      propAddr++;
      mem.writeWord(propAddr, 0x1234); // data
      propAddr += 2;

      // 2-byte header property (prop 5, length 8)
      // First byte: 0b1SPPPPPP where S=1 for 2-byte header
      mem.writeByte(propAddr, 0x80 | 5); // prop 5, 2-byte header
      propAddr++;
      // Second byte: 0b1NLLLLLL where L=length
      mem.writeByte(propAddr, 0x80 | 8); // length 8
      propAddr++;
      // Write 8 bytes of data
      for (let i = 0; i < 8; i++) {
        mem.writeByte(propAddr + i, i);
      }
      propAddr += 8;

      // 2-byte header property with length 0 = 64 (prop 3)
      mem.writeByte(propAddr, 0x80 | 3); // prop 3, 2-byte header
      propAddr++;
      mem.writeByte(propAddr, 0x80 | 0); // length 0 = 64
      propAddr++;
      // Write 64 bytes of data
      for (let i = 0; i < 64; i++) {
        mem.writeByte(propAddr + i, i);
      }
      propAddr += 64;

      // End of property list
      mem.writeByte(propAddr, 0);
    }

    it('should get V5 1-byte header property length (size 1)', () => {
      const mem = setupV5Memory();
      setupV5ObjectTable(mem);
      const objTable = new ObjectTable(mem, 5, 0x100);
      const props = new Properties(mem, 5, objTable);

      const addr10 = props.getPropertyAddress(1, 10);
      expect(addr10).toBeGreaterThan(0);
      expect(props.getPropertyLength(addr10)).toBe(1);
    });

    it('should get V5 1-byte header property length (size 2)', () => {
      const mem = setupV5Memory();
      setupV5ObjectTable(mem);
      const objTable = new ObjectTable(mem, 5, 0x100);
      const props = new Properties(mem, 5, objTable);

      const addr8 = props.getPropertyAddress(1, 8);
      expect(addr8).toBeGreaterThan(0);
      expect(props.getPropertyLength(addr8)).toBe(2);
    });

    it('should get V5 2-byte header property length', () => {
      const mem = setupV5Memory();
      setupV5ObjectTable(mem);
      const objTable = new ObjectTable(mem, 5, 0x100);
      const props = new Properties(mem, 5, objTable);

      const addr5 = props.getPropertyAddress(1, 5);
      expect(addr5).toBeGreaterThan(0);
      expect(props.getPropertyLength(addr5)).toBe(8);
    });

    it('should treat length 0 as 64 in 2-byte header', () => {
      const mem = setupV5Memory();
      setupV5ObjectTable(mem);
      const objTable = new ObjectTable(mem, 5, 0x100);
      const props = new Properties(mem, 5, objTable);

      const addr3 = props.getPropertyAddress(1, 3);
      expect(addr3).toBeGreaterThan(0);
      expect(props.getPropertyLength(addr3)).toBe(64);
    });
  });
});
