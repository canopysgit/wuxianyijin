/**
 * 测试UI组件是否正常工作
 */

import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

describe('UI Components', () => {
  describe('Button Component', () => {
    it('should render button with default variant', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('bg-primary')
    })

    it('should render button with outline variant', () => {
      render(<Button variant="outline">Outline button</Button>)
      const button = screen.getByRole('button', { name: /outline button/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('border')
    })

    it('should render button with different sizes', () => {
      render(<Button size="sm">Small button</Button>)
      const button = screen.getByRole('button', { name: /small button/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('h-9')
    })

    it('should handle disabled state', () => {
      render(<Button disabled>Disabled button</Button>)
      const button = screen.getByRole('button', { name: /disabled button/i })
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:opacity-50')
    })
  })

  describe('Card Component', () => {
    it('should render card with all components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>Card content goes here</CardContent>
        </Card>
      )

      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('Card Description')).toBeInTheDocument()
      expect(screen.getByText('Card content goes here')).toBeInTheDocument()
    })

    it('should apply correct CSS classes', () => {
      render(<Card data-testid="card">Test card</Card>)
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card')
    })
  })
})
