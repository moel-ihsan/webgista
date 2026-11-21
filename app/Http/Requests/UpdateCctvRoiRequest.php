<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateCctvRoiRequest extends FormRequest
{
    public const ROI_FIELDS = [
        'rec1x',
        'rec1y',
        'rec2x',
        'rec2y',
        'rec3x',
        'rec3y',
        'rec4x',
        'rec4y',
        'rec5x',
        'rec5y',
    ];

    /**
     * Determine if the user is authorized to update ROI coordinates.
     *
     * @return bool
     */
    public function authorize()
    {
        return $this->user() && $this->user()->role === 'admin';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules()
    {
        if ($this->has('points') || ! $this->hasAny(self::ROI_FIELDS)) {
            return [
                'points' => ['required', 'array', 'min:3'],
                'points.*.x' => ['required', 'numeric', 'min:0'],
                'points.*.y' => ['required', 'numeric', 'min:0'],
            ];
        }

        $rules = [];
        foreach (self::ROI_FIELDS as $field) {
            $rules[$field] = ['required', 'numeric', 'min:0'];
        }

        return $rules;
    }

    /**
     * Ensure submitted vertices form a non-degenerate polygon with positive area.
     *
     * @param  Validator  $validator
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($validator->errors()->any()) {
                return;
            }

            $points = $this->normalizedPoints();
            if (count($points) < 3 || $this->computePolygonArea($points) <= 0) {
                $validator->errors()->add('points', 'Koordinat harus membentuk poligon dengan luas lebih dari 0.');
            }
        });
    }

    /**
     * Normalize either an arbitrary points list or legacy rec1x..rec5y inputs.
     *
     * @return array<int, array{x: float, y: float}>
     */
    public function normalizedPoints(): array
    {
        $rawPoints = $this->input('points');
        if (is_array($rawPoints)) {
            return array_values(array_map(function ($point) {
                return [
                    'x' => round((float) $point['x'], 2),
                    'y' => round((float) $point['y'], 2),
                ];
            }, $rawPoints));
        }

        $legacyPoints = [];
        for ($idx = 1; $idx <= 5; $idx++) {
            $legacyPoints[] = [
                'x' => round((float) $this->input("rec{$idx}x"), 2),
                'y' => round((float) $this->input("rec{$idx}y"), 2),
            ];
        }

        return $legacyPoints;
    }

    /**
     * Compute polygon area via the shoelace formula.
     *
     * @param  array<int, array{x: float, y: float}>  $points
     */
    private function computePolygonArea(array $points): float
    {
        $count = count($points);
        if ($count < 3) {
            return 0.0;
        }

        $sum = 0.0;
        for ($i = 0; $i < $count; $i++) {
            $current = $points[$i];
            $next = $points[($i + 1) % $count];
            $sum += ($current['x'] * $next['y']) - ($next['x'] * $current['y']);
        }

        return abs($sum) / 2.0;
    }
}
