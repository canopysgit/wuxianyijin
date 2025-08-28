/**
 * 测试代码质量工具配置
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

describe('Code Quality Configuration Tests', () => {
  const projectRoot = path.resolve(__dirname, '..')

  describe('ESLint Configuration', () => {
    it('should have .eslintrc.json file', () => {
      const eslintConfigPath = path.join(projectRoot, '.eslintrc.json')
      expect(fs.existsSync(eslintConfigPath)).toBe(true)

      const config = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'))
      expect(config.extends).toContain('next/core-web-vitals')
      expect(config.rules).toBeDefined()
      expect(config.rules['no-console']).toBe('warn')
      expect(config.rules['prefer-const']).toBe('error')
    })

    it('should have test-specific ESLint overrides', () => {
      const eslintConfigPath = path.join(projectRoot, '.eslintrc.json')
      const config = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'))

      const testOverride = config.overrides?.find((override: any) =>
        override.files?.some((pattern: string) => pattern.includes('test'))
      )

      expect(testOverride).toBeDefined()
      expect(testOverride.rules['no-console']).toBe('off')
    })
  })

  describe('Prettier Configuration', () => {
    it('should have .prettierrc file', () => {
      const prettierConfigPath = path.join(projectRoot, '.prettierrc')
      expect(fs.existsSync(prettierConfigPath)).toBe(true)

      const config = JSON.parse(fs.readFileSync(prettierConfigPath, 'utf8'))
      expect(config.semi).toBe(false)
      expect(config.singleQuote).toBe(true)
      expect(config.printWidth).toBe(80)
      expect(config.tabWidth).toBe(2)
    })

    it('should have .prettierignore file', () => {
      const prettierIgnorePath = path.join(projectRoot, '.prettierignore')
      expect(fs.existsSync(prettierIgnorePath)).toBe(true)

      const content = fs.readFileSync(prettierIgnorePath, 'utf8')
      expect(content).toContain('node_modules')
      expect(content).toContain('.next')
      expect(content).toContain('dist')
    })
  })

  describe('Git Configuration', () => {
    it('should have .gitignore file', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore')
      expect(fs.existsSync(gitignorePath)).toBe(true)

      const content = fs.readFileSync(gitignorePath, 'utf8')
      expect(content).toContain('node_modules')
      expect(content).toContain('.env*.local')
      expect(content).toContain('.next')
    })

    it('should ignore sensitive files', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore')
      const content = fs.readFileSync(gitignorePath, 'utf8')

      // Check for important ignores
      expect(content).toContain('.env')
      expect(content).toContain('*.log')
      expect(content).toContain('*.db')
      expect(content).toContain('*.sqlite')
    })
  })

  describe('Environment Configuration', () => {
    it('should have .env.example file', () => {
      const envExamplePath = path.join(projectRoot, '.env.example')
      expect(fs.existsSync(envExamplePath)).toBe(true)

      const content = fs.readFileSync(envExamplePath, 'utf8')
      expect(content).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(content).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      expect(content).toContain('NEXT_PUBLIC_DEBUG')
    })

    it('should not contain actual secrets in .env.example', () => {
      const envExamplePath = path.join(projectRoot, '.env.example')
      const content = fs.readFileSync(envExamplePath, 'utf8')

      // Should have placeholder values, not real secrets
      expect(content).toContain('your-project-id')
      expect(content).toContain('your-anon-key')
      expect(content).not.toContain('sk-') // No real API keys
      expect(content).not.toContain('pk_live') // No production keys
    })
  })
})

describe('Package Scripts Tests', () => {
  it('should have all required npm scripts', () => {
    const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

    const requiredScripts = [
      'dev',
      'build',
      'start',
      'lint',
      'format',
      'test',
      'test:watch',
    ]

    requiredScripts.forEach(script => {
      expect(packageJson.scripts).toHaveProperty(script)
    })
  })

  it('should have proper lint script configuration', () => {
    const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

    expect(packageJson.scripts.lint).toContain('next lint')
    expect(packageJson.scripts.lint).toContain('tsc --noEmit')
  })

  it('should have proper format script configuration', () => {
    const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

    expect(packageJson.scripts.format).toBe('prettier --write .')
  })
})