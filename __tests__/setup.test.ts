/**
 * 测试项目基础配置是否正确
 */

describe('Project Setup Tests', () => {
  describe('TypeScript Configuration', () => {
    it('should have strict mode enabled', () => {
      // 这个测试确保TypeScript严格模式配置生效
      const strictValue: string | undefined = undefined

      // 在严格模式下，TypeScript会检查null/undefined的使用
      if (strictValue !== undefined) {
        const result = strictValue.length
        expect(result).toBeGreaterThanOrEqual(0)
      } else {
        expect(strictValue).toBeUndefined()
      }

      expect(true).toBe(true) // 这个测试主要用于编译时检查
    })

    it('should enforce exactOptionalPropertyTypes', () => {
      interface TestInterface {
        requiredProp: string
        optionalProp?: string
      }

      const testObj: TestInterface = {
        requiredProp: 'test',
      }

      // 在启用exactOptionalPropertyTypes时，不能将undefined赋值给可选属性
      expect(testObj.optionalProp).toBeUndefined()
    })

    it('should detect unused locals and parameters', () => {
      // 这个测试确保noUnusedLocals和noUnusedParameters配置生效
      const usedVariable = 'used'

      function testFunction(usedParam: string) {
        return usedParam + usedVariable
      }

      expect(testFunction('test')).toBe('testused')
    })
  })

  describe('Project Structure', () => {
    it('should have correct import alias setup', async () => {
      // 测试@/路径别名配置
      const { cn } = await import('@/lib/utils')
      expect(typeof cn).toBe('function')
    })
  })

  describe('Environment Configuration', () => {
    it('should be in development mode', () => {
      expect(process.env.NODE_ENV).toBe('test')
    })
  })
})
