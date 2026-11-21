<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAgencyRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to create agencies.
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
        return [
            'agency' => ['required', 'string', 'max:100', 'unique:agency_lists,agency'],
        ];
    }
}
