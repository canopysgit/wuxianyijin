/**
 * 测试项目目录结构和类型定义
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

describe('Project Structure Tests', () => {
  const projectRoot = path.resolve(__dirname, '..')

  describe('Directory Structure', () => {
    const requiredDirectories = [
      'src/app',
      'src/components/ui',
      'src/lib',
      'src/hooks',
      '__tests__',
      'public',
      'docs',
    ]

    requiredDirectories.forEach(dir => {
      it(`should have ${dir} directory`, () => {
        const dirPath = path.join(projectRoot, dir)
        expect(fs.existsSync(dirPath)).toBe(true)
        expect(fs.statSync(dirPath).isDirectory()).toBe(true)
      })
    })
  })

  describe('Essential Files', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'tailwind.config.js',
      'postcss.config.js',
      'jest.config.js',
      'jest.setup.js',
      'src/app/layout.tsx',
      'src/app/page.tsx',
      'src/app/globals.css',
      'src/lib/utils.ts',
      'src/lib/types.ts',
      'src/lib/supabase.ts',
      'src/lib/database.types.ts',
      'src/components/ui/button.tsx',
      'src/components/ui/card.tsx',
    ]

    requiredFiles.forEach(file => {
      it(`should have ${file} file`, () => {
        const filePath = path.join(projectRoot, file)
        expect(fs.existsSync(filePath)).toBe(true)
        expect(fs.statSync(filePath).isFile()).toBe(true)
      })
    })
  })

  describe('TypeScript Configuration', () => {
    it('should have valid tsconfig.json', () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
      const content = fs.readFileSync(tsconfigPath, 'utf8')
      const config = JSON.parse(content)

      expect(config.compilerOptions.strict).toBe(true)
      expect(config.compilerOptions.paths).toHaveProperty('@/*')
      expect(config.compilerOptions.target).toBe('ES2020')
    })

    it('should have valid package.json', () => {
      const packagePath = path.join(projectRoot, 'package.json')
      const content = fs.readFileSync(packagePath, 'utf8')
      const pkg = JSON.parse(content)

      expect(pkg.name).toBe('sshf-compliance-analyzer')
      expect(pkg.dependencies).toHaveProperty('next')
      expect(pkg.dependencies).toHaveProperty('react')
      expect(pkg.dependencies).toHaveProperty('@supabase/supabase-js')
      expect(pkg.devDependencies).toHaveProperty('typescript')
      expect(pkg.devDependencies).toHaveProperty('jest')
    })
  })
})

describe('Type Definitions Tests', () => {
  describe('Basic Types Import', () => {
    it('should be able to import types from lib/types', async () => {
      const types = await import('@/lib/types')

      expect(typeof types).toBe('object')
      // 测试主要类型是否存在（通过TypeScript编译即可验证）
    })

    it('should be able to import utils', async () => {
      const utils = await import('@/lib/utils')

      expect(typeof utils.cn).toBe('function')
      expect(typeof utils.formatCurrency).toBe('function')
      expect(typeof utils.formatDate).toBe('function')
      expect(typeof utils.calculatePercentage).toBe('function')
    })
  })

  describe('Utility Functions', () => {
    it('should format currency correctly', async () => {
      const { formatCurrency } = await import('@/lib/utils')

      expect(formatCurrency(1000)).toMatch(/¥/)
      expect(formatCurrency(1234.56)).toMatch(/1,234\.56/)
    })

    it('should format date correctly', async () => {
      const { formatDate } = await import('@/lib/utils')

      const testDate = new Date('2023-06-15')
      const formatted = formatDate(testDate)
      expect(formatted).toMatch(/2023.*6.*15/)
    })

    it('should calculate percentage correctly', async () => {
      const { calculatePercentage } = await import('@/lib/utils')

      expect(calculatePercentage(25, 100)).toBe(25)
      expect(calculatePercentage(1, 3)).toBe(33) // rounded
      expect(calculatePercentage(10, 0)).toBe(0) // handle division by zero
    })
  })
})
