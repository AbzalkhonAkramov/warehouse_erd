import 'package:flutter/material.dart';

/// Brand + semantic colours for the agent app. The Material theme is seeded from
/// [brand]; these extra tokens cover states the ColorScheme doesn't express
/// (success / warning / info) and the order/invoice status accents.
abstract final class AppColors {
  static const brand = Color(0xFF2563EB); // blue-600
  static const brandDark = Color(0xFF1E40AF); // blue-800

  static const success = Color(0xFF16A34A); // green-600
  static const warning = Color(0xFFF59E0B); // amber-500
  static const danger = Color(0xFFDC2626); // red-600
  static const info = Color(0xFF2563EB);
  static const neutral = Color(0xFF64748B); // slate-500

  static const surfaceSoft = Color(0xFFF6F8FB); // page background
  static const line = Color(0xFFE7ECF3); // hairline dividers/borders

  /// Accent colour for a sales-order status.
  static Color orderStatus(String s) {
    switch (s) {
      case 'shipped':
        return info;
      case 'delivered':
        return success;
      case 'refund':
        return const Color(0xFF7C3AED); // violet-600
      case 'cancelled':
        return neutral;
      default:
        return warning; // new
    }
  }

  /// Accent colour for an invoice status.
  static Color invoiceStatus(String s) {
    switch (s) {
      case 'paid':
        return success;
      case 'partial':
        return warning;
      default:
        return danger; // unpaid
    }
  }
}
