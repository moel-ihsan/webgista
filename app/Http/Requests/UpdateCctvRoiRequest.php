<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
        $rules = [];
        foreach (self::ROI_FIELDS as $field) {
            $rules[$field] = ['required', 'numeric', 'min:0'];
        }

        return $rules;
    }
}
