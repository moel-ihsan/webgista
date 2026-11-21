<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

abstract class CctvPointRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to manage CCTV points.
     *
     * @return bool
     */
    public function authorize()
    {
        return $this->user() && $this->user()->role === 'admin';
    }

    /**
     * Get shared validation rules for creating or updating a CCTV point.
     *
     * @return array<string, mixed>
     */
    public function rules()
    {
        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(['Analytic', 'Regular'])],
            'address' => ['required', 'string', 'max:255'],
            'lattitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'agency' => ['required', 'string', 'max:255'],
            'url' => ['nullable', 'string', 'max:2048'],
        ];

        foreach (UpdateCctvRoiRequest::ROI_FIELDS as $field) {
            $rules[$field] = ['nullable', 'numeric', 'min:0'];
        }

        return $rules;
    }
}
